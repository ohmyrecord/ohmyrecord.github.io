(() => {
 const sections = [...document.querySelectorAll('.rail-section')];
 const stops = [0, 90, 184], labels = ['기대기', '걸터앉기', '앉기'];
 let cursor = 0, mode = 0, request = 0;
 function paint(){
   const frame=staygapSide.frame(cursor), joints=frame.joints;
   for(const group of sections){
     staygapSide.draw(group,frame);
     group.querySelector('.signal').setAttribute('fill',mode?'#79ad52':'#be4557');
     group.querySelector('.pose-label').textContent=labels[mode];

   }
   window.sideRailJoints=joints;
   ['diagramUpper','diagramLower'].forEach((id,i)=>document.getElementById(id).setAttribute('transform',`translate(${joints[i].join(' ')})`));
   document.dispatchEvent(new Event('staygap:sideframe'));
 }
 document.addEventListener('staygap:mode',({detail})=>{
   cancelAnimationFrame(request);mode=detail;
   const start=cursor,end=stops[mode],began=performance.now(),duration=Math.max(180,Math.abs(end-start)*13);
   function step(now){
     const t=matchMedia('(prefers-reduced-motion: reduce)').matches?1:Math.min(1,(now-began)/duration);
     cursor=start+(end-start)*t;paint();
     if(t<1)request=requestAnimationFrame(step);
   }
   request=requestAnimationFrame(step);
 });
 paint();
})();
