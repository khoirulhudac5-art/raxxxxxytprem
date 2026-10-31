// Read-only diagnostics. No credentials, response bodies or hostnames are printed.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
async function main(){
 if(!url||!key?.startsWith('sb_publishable_'))throw Error('Environment Supabase tidak lengkap/format key tidak didukung.');
 for(const [stage,path,method] of [['auth-health','/auth/v1/health','GET'],['products-read','/rest/v1/products?select=id&limit=1','GET'],['is_admin-anon','/rest/v1/rpc/is_admin','POST']]){
  try{const response=await fetch(url+path,{method,headers:{apikey:key,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(12000)});
   const result={stage,status:response.status};
   if(stage==='is_admin-anon'&&response.ok)result.expectedFalse=(await response.json())===false;
   console.log(JSON.stringify(result));if(!response.ok||result.expectedFalse===false)process.exitCode=1;
  }catch(error){const safe=new Set(['EACCES','EPERM','ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT']);console.log(JSON.stringify({stage,networkCode:safe.has(error.cause?.code)?error.cause.code:'NETWORK_ERROR'}));process.exitCode=1;}
 }
}
main().catch(()=>{console.error('Diagnostic configuration check failed. No credentials printed.');process.exitCode=1;});
