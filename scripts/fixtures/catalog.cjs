// Synthetic, non-sensitive test data. Never used by application code or uploaded to a database.
// Stable IDs exercise the existing migration-order contract; seven products/two plans preserve all suite assertions.
const fs=require('node:fs');
const ids=['chatgpt','capcut','canva','google','youtube','spotify','zoom'];
const icons=['spark','video','design','gem','play','music','camera'];
const colors=['green','white','cyan','blue','red','lime','blue'];
const synthetic={products:ids.map((id,i)=>({id,name:i===0?'ChatGPT Plus':'Synthetic Product '+(i+1),description:'Synthetic description '+(i+1),category:i%2?'Synthetic Video':'Synthetic Tools',icon:icons[i],color:colors[i],badge:i%2?'Synthetic badge':'',imageUrl:i%3===0?'https://example.invalid/synthetic-'+i+'.png':'',plans:[{duration:'Synthetic month',price:1000+i*100},{duration:'Synthetic year',price:5000+i*100}]})),whatsapp:{number:'10000000000',template:'Synthetic order {produk} / {durasi} / {harga}'}};
function catalogReference(){
 if(process.argv.includes('--live')){
  const index=process.argv.indexOf('--reference');
  if(index<0||!process.argv[index+1])throw Error('Live comparison requires an explicit --reference JSON file; synthetic data must never be compared to production.');
  return JSON.parse(fs.readFileSync(process.argv[index+1],'utf8'));
 }
 return structuredClone(synthetic);
}
module.exports={catalogReference};
