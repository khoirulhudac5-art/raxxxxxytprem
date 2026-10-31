const listeners = new Set<()=>void>();
const channelName = 'rakyat-products-refresh-v1';
const sender = Math.random().toString(36).slice(2);

export function subscribeProductsRefresh(listener:()=>void) {
 listeners.add(listener);
 const channel = typeof window!=='undefined' && typeof BroadcastChannel!=='undefined' ? new BroadcastChannel(channelName) : null;
 if (channel) channel.onmessage = event => {
  if (event.data?.type==='products-refresh' && event.data.sender!==sender) listener();
 };
 return ()=>{listeners.delete(listener);channel?.close();};
}

// Call ONLY after a future mutation is confirmed by the database. Not connected to
// any CRUD handler today. Carries no products, tokens, or localStorage data.
export function refreshSupabaseProducts() {
 for (const listener of listeners) listener();
 if (typeof window!=='undefined' && typeof BroadcastChannel!=='undefined') {
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({type:'products-refresh',sender});
  channel.close();
 }
}
