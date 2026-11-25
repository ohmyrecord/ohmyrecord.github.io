// Both 3D views use independent scenes and the same authored v7 animation.
window.loadStaygapRail = async function (T) {
  const bytes = Uint8Array.from(atob(window.StaygapRailData), c => c.charCodeAt(0));
  const gltf = await new Promise((resolve, reject) => {
    new T.GLTFLoader().parse(bytes.buffer, '', resolve, reject);
  });
  const rig = gltf.scene;
  // The existing hand, raycast and projected hints address the four side buttons.
  for (const [joint, name] of ['upper', 'lower'].entries()) {
    for (const side of [-1, 1]) {
      const button = rig.getObjectByName('Button_' + joint + '_' + side);
      button.name = 'press_' + name + '_' + (side < 0 ? 'left' : 'right');
    }
  }
  const mixer = new T.AnimationMixer(rig);
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const stops = [0, 3.75, clip.duration];
  return {rig, pose(position) {
    const segment = position <= 1 ? 0 : 1;
    const fraction = position - segment;
    action.time = stops[segment] + (stops[segment + 1] - stops[segment]) * fraction;
    mixer.update(0);
  }};
};
