// Mock Auth tests only: no network, real credentials, database or storage access.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
function load(path,imports={}) {
 const ctx={exports:{},URL,require:name=>name==='server-only'?{}:name.endsWith('auth-diagnostics')?{logAuthFailure:()=>{},authFetch:()=>{}}:name in imports?imports[name]:require(name)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 return ctx.exports;
}
const {checkAdminAccess}=load('src/lib/supabase/admin-access.ts');
const origin=load('src/lib/supabase/auth-request.ts');
const req=(url,body='',headers={origin:'http://localhost:3000'})=>new NextRequest('http://localhost:3000'+url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...headers},body});
async function run() {
 let rpcCalls=0;
 function client(user,error=null,membership=true,rpcError=null){return {auth:{getUser:async()=>({data:{user},error})},rpc:async name=>{rpcCalls++;assert.equal(name,'is_admin');return {data:membership,error:rpcError};}};}
 assert.equal(await checkAdminAccess(async()=>client(null)),'unauthenticated');assert.equal(rpcCalls,0);
 assert.equal(await checkAdminAccess(async()=>client(null,{name:'AuthSessionMissingError'})),'unauthenticated');
 assert.equal(await checkAdminAccess(async()=>client(null,{status:401})),'unauthenticated');
 assert.equal(await checkAdminAccess(async()=>client(null,{status:503})),'unavailable');
 assert.equal(await checkAdminAccess(async()=>{throw Error('config');}),'unavailable');
 assert.equal(await checkAdminAccess(async()=>client({id:'verified'},null,true)),'admin');
 for(const value of [false,null,'true',1])assert.equal(await checkAdminAccess(async()=>client({id:'verified'},null,value)),'denied');
 assert.equal(await checkAdminAccess(async()=>client({id:'verified'},null,true,{code:'42501'})),'unavailable');
 let authCalls=0;
 const makeLogin=error=>load('src/app/admin/login/submit/route.ts',{
  '@/lib/supabase/auth-request':origin,
  '@/lib/supabase/server':{createClient:async response=>({auth:{signInWithPassword:async credentials=>{
   authCalls++;assert.equal(credentials.email,'admin@example.invalid');assert.equal(credentials.password,'fake-only');
   if(!error)response.cookies.set('test-auth','fake');return {error};
  }}})},
 });
 const login=makeLogin(null);
 assert.equal((await login.POST(req('/admin/login/submit','email=a&password=b',{origin:'https://other.invalid'}))).status,403);
 assert.equal(authCalls,0);
 assert.ok((await login.POST(req('/admin/login/submit','email=&password='))).headers.get('location').includes('error=invalid'));assert.equal(authCalls,0);
 const ok=await login.POST(req('/admin/login/submit','email=admin%40example.invalid&password=fake-only'));
 assert.equal(ok.status,303);assert.equal(new URL(ok.headers.get('location')).pathname,'/admin');assert.ok(ok.cookies.get('test-auth'));
 const bad=await makeLogin({status:400}).POST(req('/admin/login/submit','email=admin%40example.invalid&password=fake-only'));
 assert.ok(bad.headers.get('location').includes('error=invalid'));
 let logoutCalls=0;
 const logout=load('src/app/admin/logout/route.ts',{'@/lib/supabase/auth-request':origin,
  '@/lib/supabase/server':{createClient:async response=>({auth:{signOut:async options=>{logoutCalls++;assert.equal(options.scope,'local');response.cookies.set('test-auth','',{maxAge:0});return {error:null};}}})}});
 assert.equal((await logout.POST(req('/admin/logout','',{origin:'https://other.invalid'}))).status,403);assert.equal(logoutCalls,0);
 const out=await logout.POST(req('/admin/logout'));assert.equal(new URL(out.headers.get('location')).pathname,'/admin/login');assert.equal(logoutCalls,1);
 const middleware=load('src/middleware.ts',{'@/lib/supabase/env':{getSupabaseEnvironment:()=>({url:'https://example.invalid',publishableKey:'fake'})},
  '@supabase/ssr':{createServerClient:(url,key,config)=>({auth:{getClaims:async()=>{
   config.cookies.setAll([{name:'first',value:'a',options:{}}],{'Cache-Control':'private, no-store','Expires':'0'});
   config.cookies.setAll([{name:'second',value:'b',options:{}}],{});
  }}})}});
 const response=await middleware.middleware(new NextRequest('http://localhost:3000/admin'));
 assert.ok(response.cookies.get('first'));assert.ok(response.cookies.get('second'));assert.equal(response.headers.get('expires'),'0');
 assert.equal(middleware.config.matcher[0],'/admin/:path*');
 console.log('PASS: verified identity + is_admin strict true, fail-closed errors, no membership query without user, same-origin POST, login/logout redirects/cookies, middleware refresh cookies/cache headers. Mock only, no live Auth calls.');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
