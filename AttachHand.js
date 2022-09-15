// -----JS CODE-----
// @input SceneObject targetObject
// @input Component.Text debugText


// Do this on every update step
script.createEvent("UpdateEvent").bind(function () {
    
// Get the tracked hand
var hand = global.handTracking.getHand();
    
// If it's not there, disable the object and exit
if (hand === undefined) {
script.targetObject.enabled = false;
return;
}
//// Otherwise, enable the object
//script.targetObject.enabled = true;
//// Set its pose to match the palm
//var transform = script.targetObject.getTransform();
//transform.setWorldPosition(hand.palmCenter);
//transform.setWorldRotation(hand.rotation);
//    
    
    
// Get positions
var index = hand.indexFinger.tip.position;
var thumb = hand.thumb.tip.position;
    
    
// Get & show distance
var dist = index.distance(thumb);
script.debugText.text = dist.toFixed(1);
    
    
// Move object between positions and face camera
var pos = index.add(thumb).uniformScale(0.5);
//script.getTransform().setWorldPosition(pos);
//var cam = script.cameraObject.getTransform();
//var rot = cam.getWorldRotation();
//script.getTransform().setWorldRotation(rot);
// Set a global bool for "pinch active"
global.pinchActive = dist < 3.5;
    
print(dist.toFixed(1));
});
