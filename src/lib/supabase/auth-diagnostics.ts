// Server-side diagnostics only. Never log messages, request bodies, URLs or headers.
const networkCodes=new Set(['EACCES','EPERM','ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','DEPTH_ZERO_SELF_SIGNED_CERT']);
export function logAuthFailure(stage:string,error:unknown){
 const e=error as {status?:unknown;code?:unknown;name?:unknown;cause?:unknown}|null;
 const details:{stage:string;status?:number;code?:string;networkCode?:string}={stage};
 if(typeof e?.status==='number')details.status=e.status;
 if(typeof e?.code==='string'&&/^(?:[0-9]{5}|PGRST[0-9]{3}|invalid_credentials|over_request_rate_limit|request_timeout)$/.test(e.code))details.code=e.code;
 let current:unknown=error;
 for(let i=0;i<5&&current&&typeof current==='object';i++){
  const item=current as {code?:unknown;cause?:unknown};
  if(typeof item.code==='string'&&networkCodes.has(item.code)){details.networkCode=item.code;break;}
  current=item.cause;
 }
 console.error('[admin-auth]',JSON.stringify(details));
}
export const authFetch:typeof fetch=async(input,init)=>{
 try{return await fetch(input,init);}catch(error){logAuthFailure('supabase.fetch',error);throw error;}
};
