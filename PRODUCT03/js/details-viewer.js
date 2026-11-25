(()=>{'use strict';
const $=s=>document.querySelector(s),host=$('#detail3dStage'),wrap=host.parentElement,status=$('#detail3dStatus');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let desired3d=false,ready=false,loading=false,visible=false,currentMode=0,position=0,startPosition=0,started=0,renderer,scene,camera,rig,T,yaw=2.44;
const specs=[
  [
    "기대기",
    "449 × 149 mm",
    "등받이 중앙 높이 1,340 mm",
    "등받이 수직 · 세 패널 접힘",
    "레일 최상단 사용 위치",
    "위 관절 중심 높이 1,050 mm"
  ],
  [
    "걸터앉기",
    "449 × 446 mm",
    "경사 좌판 중앙 높이 683 mm",
    "좌판 경사 45° · 앞쪽으로 하향",
    "기대기 위치에서 225 mm 하강",
    "위 관절 중심 높이 825 mm"
  ],
  [
    "앉기",
    "449 × 569 mm",
    "수평 좌판 윗면 높이 461 mm",
    "좌판 경사 0° · 패널 깊이 384 mm",
    "기대기 위치에서 600 mm 하강",
    "위 관절 중심 높이 450 mm"
  ]
];
function drawing(i){['specMode','specSize','specJoint','specSurface','specGround','specAxis'].forEach((id,j)=>$('#'+id).textContent=specs[i][j]);}document.addEventListener('staygap:drawing',e=>drawing(e.detail));drawing(0);
function activate(i){window.pressStaygapJoint(i);}
document.addEventListener('staygap:mode',e=>{startPosition=position;currentMode=e.detail;host.querySelector('.joint-tap-hint')?.setAttribute('aria-label',currentMode===1?'위 버튼 · 기대기로 돌아가기':'위 버튼 · 걸터앉기');started=performance.now();});
function show(on){visible=on;host.hidden=false;wrap.classList.toggle('is-3d',on);$('#showDiagram').setAttribute('aria-pressed',String(!on));$('#showDetail3d').setAttribute('aria-pressed',String(on));status.textContent=on?'노란 관절을 톡 · 드래그해서 회전':'';if(on&&ready)resize();}
function load(src,test){if(test())return Promise.resolve();return new Promise((resolve,reject)=>{let el=[...document.scripts].find(s=>s.src.endsWith(src));if(!el){el=document.createElement('script');el.src=src;document.head.append(el);}el.addEventListener('load',resolve,{once:true});el.addEventListener('error',reject,{once:true});});}
async function init(){if(loading)return;loading=true;status.textContent='입체 모델을 불러오는 중…';try{await load('../js/vendor/three.min.js',()=>!!window.THREE);await load('../js/vendor/three-addons.js',()=>!!window.THREE?.GLTFLoader);T=window.THREE;
renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0xd9d8cd,1);host.append(renderer.domElement);
const rail=await loadStaygapRail(T);rig=rail.rig;scene=new T.Scene();scene.add(rig);camera=new T.PerspectiveCamera(32,1,.01,50);scene.add(new T.HemisphereLight(0xffffff,0x77715f,3));const key=new T.DirectionalLight(0xffffff,4);key.position.set(3,5,4);scene.add(key);const fill=new T.DirectionalLight(0xffedca,2);fill.position.set(-3,2,-2);scene.add(fill);
const studio=new T.Scene();studio.background=new T.Color(0xdeddd3);const wall=new T.Mesh(new T.PlaneGeometry(10,10),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}));wall.position.set(0,3,3);studio.add(wall);const env=new T.PMREMGenerator(renderer);scene.environment=env.fromScene(studio,.04).texture;env.dispose();
const caps=[];rig.traverse(o=>{if(o.isMesh&&o.name.startsWith('press_')){o.geometry.computeBoundingBox();caps.push(o);}});
const hints=[1,2].map(i=>{const b=document.createElement('button');b.className='joint-tap-hint';b.type='button';b.innerHTML='<i aria-hidden="true"></i><span>여기를 톡</span>';b.setAttribute('aria-label',i===1?(currentMode===1?'위 버튼 · 기대기로 돌아가기':'위 버튼 · 걸터앉기'):'아래 관절: 앉기');b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.stopPropagation();activate(i);});host.append(b);return b;});
let down=false,moved=false,x0=0,y0=0,last=0;const ray=new T.Raycaster(),pointer=new T.Vector2();host.addEventListener('pointerdown',e=>{if(e.target!==renderer.domElement)return;down=true;moved=false;x0=last=e.clientX;y0=e.clientY;host.setPointerCapture(e.pointerId);});host.addEventListener('pointermove',e=>{if(!down)return;if(Math.hypot(e.clientX-x0,e.clientY-y0)>6)moved=true;if(moved)yaw-=(e.clientX-last)*.01;last=e.clientX;});host.addEventListener('pointerup',e=>{if(!down)return;down=false;if(moved)return;const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(pointer,camera);let cap=ray.intersectObjects(caps,false)[0]?.object;if(!cap){let best=24;caps.forEach(c=>{const v=c.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(c.matrixWorld).project(camera),d=Math.hypot((v.x+1)*r.width/2+r.left-e.clientX,(1-v.y)*r.height/2+r.top-e.clientY);if(d<best){best=d;cap=c;}});}if(cap)activate(cap.name.includes('upper')?1:2);});host.addEventListener('pointercancel',()=>down=false);
new ResizeObserver(resize).observe(host);ready=true;position=currentMode;show(desired3d);
function frame(now){requestAnimationFrame(frame);if(!visible)return;const t=reduced.matches?1:Math.min(1,(now-started)/480),ease=t*t*(3-2*t);position=started?startPosition+(currentMode-startPosition)*ease:currentMode;rail.pose(position);camera.position.set(Math.sin(yaw)*3.5,1.15,Math.cos(yaw)*3.5);camera.lookAt(0,.9,0);renderer.render(scene,camera);const r=host.getBoundingClientRect();
hints.forEach((hint,j)=>{let best=Infinity,point;caps.filter(c=>c.name.includes(j===0?'upper':'lower')).forEach(c=>{const p=c.geometry.boundingBox.getCenter(new T.Vector3()).applyMatrix4(c.matrixWorld),d=p.distanceToSquared(camera.position);if(d<best){best=d;point=p;}});point.project(camera);hint.hidden=Math.abs(point.x)>1||Math.abs(point.y)>1||Math.abs(point.z)>1;hint.style.left=(point.x+1)*r.width/2+'px';hint.style.top=(1-point.y)*r.height/2+'px';hint.classList.toggle('hint-left',j===1);});}requestAnimationFrame(frame);
}catch(e){show(false);status.textContent='이 환경에서는 3D를 표시할 수 없어 구조 그림으로 보여드립니다.';if(renderer){renderer.dispose();renderer.domElement.remove();}console.warn('STAY GAP detail 3D:',e);}finally{loading=false;}}
function resize(){if(!renderer||!camera||!visible)return;const r=host.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function chooseView(on){desired3d=on;if(!on)show(false);else if(ready)show(true);else init();}
[['#showDiagram',false],['#showDetail3d',true]].forEach(([selector,on])=>{const button=$(selector);button.addEventListener('click',()=>chooseView(on));button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')chooseView(on);});button.addEventListener('focus',()=>chooseView(on));});
})();
