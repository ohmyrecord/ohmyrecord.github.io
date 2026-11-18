(()=>{'use strict';
const wave=document.querySelector('.section-wave'),path=wave?.querySelector('path'),why=document.querySelector('#why'),header=document.querySelector('header');
if(!wave||!why)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=x=>Math.max(0,Math.min(1,x));
function update(){const hero=document.querySelector('#top'),r=hero.getBoundingClientRect(),travel=Math.max(1,r.height*.72),k=clamp((-r.top-r.height*.08)/travel),ey=100*(1-k),cy=ey-80*Math.sin(Math.PI*Math.min(1,k*1.15));path.setAttribute('d',`M0 101 L0 ${ey} Q50 ${cy} 100 ${ey} L100 101Z`);const w=why.getBoundingClientRect();header.classList.toggle('on-ivory',w.top<=80&&w.bottom>80);}
let pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;update();});}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);update();
})();
