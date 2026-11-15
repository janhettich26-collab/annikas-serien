// Einmalig: Serien aus seed.txt bei TVmaze suchen -> data/shows.json
import fs from 'fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=async u=>{for(let i=0;i<4;i++){const r=await fetch(u);if(r.status===429){await sleep(3000);continue}if(!r.ok)return null;return r.json()}return null};
const today=new Date().toISOString().slice(0,10);
const ids=fs.existsSync('scripts/ids.json')?JSON.parse(fs.readFileSync('scripts/ids.json')):{};
const out=[];
for(const line of fs.readFileSync('scripts/seed.txt','utf8').trim().split('\n')){
  const [nr,title,q,y,s,e,st]=line.split('|');
  let id=ids[nr];
  if(!id&&q!=='?'){
    const res=await get('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(q))||[];
    let c=res.map(r=>r.show);
    const exact=c.filter(x=>x.name.toLowerCase()===q.toLowerCase());
    if(exact.length)c=exact;
    if(y){const m=c.filter(x=>(x.premiered||'').startsWith(y));if(m.length)c=m;}
    id=c[0]?.id; await sleep(550);
  }
  let sh=id?await get(`https://api.tvmaze.com/shows/${id}?embed=seasons`):null; await sleep(550);
  const row={id:'t'+id,nr:+nr,title,tv:id||null,init:{st,s:+s,e:e?+e:null},s:+s};
  if(sh){
    const se=sh._embedded.seasons;
    row.name=sh.name;row.year=(sh.premiered||'').slice(0,4);
    row.img=sh.image?.medium||null;
    row.net=sh.network?.name||sh.webChannel?.name||'';
    row.run=sh.status;
    row.aired=se.filter(x=>x.premiereDate&&x.premiereDate<=today).length;
    row.max=se.length?Math.max(...se.map(x=>x.number)):0;
    const up=se.find(x=>!x.premiereDate||x.premiereDate>today);
    row.next=up?{s:up.number,d:up.premiereDate||null}:null;
    row.genres=sh.genres;
  }
  out.push(row);
  console.log([nr,title,'=>',row.name||'???',row.year||'',row.net||'',`aired ${row.aired} max ${row.max}`,row.run||'',row.next?JSON.stringify(row.next):'',row.img?'':'KEIN BILD',(row.aired!==undefined&&row.s>row.aired)?'<<S>aired':''].join(' | '));
}
out.forEach(r=>delete r.s);fs.writeFileSync('data/shows.json',JSON.stringify(out,null,0).replace(/\},\{"id"/g,'},\n{"id"'));
