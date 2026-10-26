const fs=require('fs');
const root='C:/Users/ohadr/Documents/Default Project/';
const m=require(root+'data/research/manual-facts.json');
const idx=require(root+'data/didyouknow/index.json');
const ids=idx.streets?idx.streets.map(x=>x.id||x):idx;
let bad=0;const facts=new Set();let missing=0;
for(const [id,e] of Object.entries(m.streets)){
  if(facts.has(e.fact)){console.log('DUP FACT',id);bad++;}
  facts.add(e.fact);
  const cp=root+`data/research/candidates/${id}.json`;
  const txt=fs.readFileSync(root+`data/didyouknow/${id}.txt`,'utf8').match(/^fact: (.*)$/m)?.[1];
  if(txt!==e.fact){console.log('TXT SYNC',id);bad++;}
  if(!fs.existsSync(cp)){missing++;continue;}
  const c=JSON.parse(fs.readFileSync(cp,'utf8'));
  if(c.fact!==e.fact){console.log('CAND SYNC',id);bad++;}
}
console.log('manual',Object.keys(m.streets).length,'index',ids.length,'uniqueFacts',facts.size,'noCandidate',missing,'bad',bad);
