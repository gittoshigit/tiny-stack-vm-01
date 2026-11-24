import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Metadata packs immediate length, pop count, and push count. 0 marks an unknown opcode.
const meta=Uint8Array.from('AR\x82EGKLP00000000JJJJJJJFJJJFJJJ0JJJ0000000000000aeeaA00000000000FI00000000000000EEBE',c=>c==='0'?0:c.charCodeAt(0)-64);
const binary=[
  (a,b)=>a+b,(a,b)=>a-b,Math.imul,(a,b)=>a/b,(a,b)=>a%b,
  (a,b)=>(a>>>0)/(b>>>0),(a,b)=>(a>>>0)%(b>>>0),,
  (a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,,
  (a,b)=>a<<b,(a,b)=>a>>b,(a,b)=>a>>>b,,
  (a,b)=>a===b,(a,b)=>a<b,(a,b)=>(a>>>0)<(b>>>0)
];

function run(p,input){
  const s=new Int32Array(256),calls=new Int32Array(64),mem=new Int32Array(256);
  const out=new Uint8Array(65536);
  let pc=0,sp=0,depth=0,r=0,w=0;
  const done=code=>[code,out.subarray(0,w)];
  for(let steps=0;;steps++){
    if(steps===1000000)return done(10);
    if(pc<0||pc>=p.length)return done(9);
    const op=p[pc],m=meta[op];
    if(!m)return done(5);
    const imm=(m-1)>>4,pop=((m-1)>>2)&3;
    if(pc+imm>=p.length)return done(9);
    if(sp<pop)return done(2);
    if(sp-pop+((m-1)&3)>256)return done(3);
    const i=pc+1;
    pc=i+imm;
    switch(op){
      case 0:return done(0);
      case 1:s[sp++]=p[i]<<24>>24;break;
      case 2:s[sp++]=p.readInt32LE(i);break;
      case 3:sp--;break;
      case 4:s[sp]=s[sp-1];sp++;break;
      case 5:{
        const b=s[sp-1];
        s[sp-1]=s[sp-2];s[sp-2]=b;
        break;
      }
      case 6:s[sp]=s[sp-2];sp++;break;
      case 7:{
        const a=s[sp-3];
        s[sp-3]=s[sp-2];s[sp-2]=s[sp-1];s[sp-1]=a;
        break;
      }
      case 23:s[sp-1]=-s[sp-1];break;
      case 27:s[sp-1]=~s[sp-1];break;
      case 48:case 49:case 50:
        if(op===48||(op===49)===(s[--sp]===0))pc+=p.readInt16LE(i);
        break;
      case 51:
        if(depth===64)return done(7);
        calls[depth++]=pc;pc=p.readUInt16LE(i);
        break;
      case 52:
        if(!depth)return done(8);
        pc=calls[--depth];
        break;
      case 64:case 65:{
        const a=s[sp-1];
        if(a<0||a>=256)return done(6);
        if(op===64)s[sp-1]=mem[a];
        else mem[a]=s[sp-=2];
        break;
      }
      case 80:{
        const t=String(s[sp-1]);
        if(w+t.length>65536)return done(11);
        sp--;
        for(let j=0;j<t.length;j++)out[w++]=t.charCodeAt(j);
        break;
      }
      case 81:
        if(w===65536)return done(11);
        out[w++]=s[--sp];
        break;
      case 82:s[sp++]=r<input.length?input[r++]:-1;break;
      case 83:return done(s[--sp]&255);
      default:{
        const b=s[--sp];
        if(op>=19&&op<=22&&b===0)return done(4);
        s[sp-1]=binary[op-16](s[sp-1],b);
      }
    }
  }
}

const input=process.env.MAKEFUN_INPUT_DIR??'/input';
const output=process.env.MAKEFUN_OUTPUT_DIR??'/output';
const ids=readdirSync(input,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
for(const id of ids){
  const src=join(input,id),dst=join(output,id);
  const [code,stdout]=run(readFileSync(join(src,'program.bin')),readFileSync(join(src,'input.bin')));
  mkdirSync(dst,{recursive:true});
  writeFileSync(join(dst,'stdout.bin'),stdout);
  writeFileSync(join(dst,'exit.txt'),code+'\n');
}
