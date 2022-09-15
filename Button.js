// -----JS CODE-----

// @input SceneObject purchaseButton


// We keep track of "colliderCount" because each hand has 46 colliders.
script.count = 0;
var obj = script.getSceneObject();
var collider = obj.getComponent("Physics.ColliderComponent");
script.purchaseButton.enabled = false;


//
script.handleTouch = function() {
    print("Is Touch");
    
    
    script.getSceneObject().getParent().enabled = false;
    
    script.purchaseButton.enabled = true;
//    script.getSceneObject().getChild().enabled = true;
    
}

script.handleRelease = function() {
    print("Is not Touch");
    
    
    
    script.getSceneObject().getParent().enabled = true;
}
collider.onOverlapEnter.add(function (e) {
 if (script.count === 0) {
 script.handleTouch();
 }
 script.count++;
});
collider.onOverlapExit.add(function (e) {
 script.count--;
 if (script.count <= 0) {
 script.handleRelease();
 script.count = 0;
 }
});