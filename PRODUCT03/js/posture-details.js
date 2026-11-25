(()=>{'use strict';
const svg=document.querySelector('#postureDiagram');
const upper=document.querySelector('#diagramUpper'),lower=document.querySelector('#diagramLower');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function paint(mode){
 const label=mode===1?'위 버튼 · 기대기로 돌아가기':'위 버튼 · 걸터앉기';
 document.querySelector('.diagram-instruction').textContent=label+'  /  아래 버튼 · 앉기';
 upper.setAttribute('aria-label',label);

}
if(svg){
 paint(0);
 document.addEventListener('staygap:mode',e=>paint(e.detail));
 for(const button of [upper,lower]){
   const activate=()=>window.pressStaygapJoint(Number(button.dataset.diagramMode));
   button.addEventListener('click',activate);
   button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
 }
}
// Reveal the text in reading order while scrolling; preserve emphasis colors.
const blocks=[...document.querySelectorAll('#why h2,#why .lead')].map(block=>{
 const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 const words=[];nodes.forEach(node=>{const color=getComputedStyle(node.parentElement).color.match(/[\d.]+/g).slice(0,3).map(Number),fragment=document.createDocumentFragment();node.textContent.split(/(\s+)/).forEach(part=>{if(!part)return;if(/^\s+$/.test(part)){fragment.append(document.createTextNode(part));return;}const word=document.createElement('span');word.className='scroll-read-word';word.textContent=part;fragment.append(word);words.push({word,color});});node.replaceWith(fragment);});return {block,words};});
function updateReading(){blocks.forEach(({block,words})=>{const rect=block.getBoundingClientRect(),progress=reduced.matches?1:Math.max(0,Math.min(1,(innerHeight*.86-rect.top)/(innerHeight*.48+rect.height*.2)));words.forEach(({word,color},i)=>{const t=Math.max(0,Math.min(1,progress*(words.length+2)-i));word.style.color=`rgb(${color.map((v,j)=>Math.round([185,187,176][j]+(v-[185,187,176][j])*t)).join(',')})`;});});}
let pending=false;function onScroll(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;updateReading();});}addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);updateReading();
})();
