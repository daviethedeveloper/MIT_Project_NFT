// HandColliders.js
// Version: 0.3.0
// Event: On Awake
// Description: Creates collider objects that match hand pose.
// Subscribes to hand tracking events to hide/show objects.
// NOTE: This is a basic example, and has not been tested on range of hand sizes and types.

// @input SceneObject colliderObject
// @input bool isLeftHand
// @ui {"widget":"separator"}
// @input bool intangible = false
// @input bool startVisible = true
// @input bool showMesh = true
// @input bool showCollider = false

if (script.colliderObject === undefined) {
    print("ERROR: Missing reference to joint object");
    script.getSceneObject().destroy();
    return;
}

script.fingerColliders = [];
script.palmBones = [];
script.colliderObjects = [];
script.renderMeshes = [];
script.bodyComponents = [];

script.isVisible = undefined;

//////////////////////////////////////////////////////////////////////////////////
//
// FINGER COLLIDER
// A collider that sits either on one joint or between two joints
//

global.fingerCollider = function (jointObj, baseJoint, parent, endJoint) {
    this.baseJoint = baseJoint;
    this.endJoint = endJoint;
    this.object = parent.copyWholeHierarchy(jointObj);
    this.objectTransform = this.object.getTransform();
    this.update();
}

global.fingerCollider.prototype.update = function () {
    if (this.endJoint !== undefined) {
        this.position = this.baseJoint.position.add(this.endJoint.position).uniformScale(0.5);
    }
    else {
        this.position = this.baseJoint.position;
    }
    this.rotation = this.baseJoint.rotation;
    this.objectTransform.setWorldPosition(this.position);
    this.objectTransform.setWorldRotation(this.rotation);
}

//////////////////////////////////////////////////////////////////////////////////
//
// PALM BONE
// A collection of colliders that connect the wrist to the base of a finger.
// There is no palm bone for the thumb.
//

global.palmBone = function (jointObj, hand, baseFingerJoint, offset, parent) {
    this.objects = [];    
    this.objectTransforms = [];
    this.hand = hand;
    this.baseFingerJoint = baseFingerJoint;
    this.offset = offset;
    
    for (var i = 0; i < 4; i++) {
        var obj = parent.copyWholeHierarchy(jointObj);
        this.objects.push(obj);
        this.objectTransforms.push(obj.getTransform());
    }
}

global.palmBone.prototype.update = function () {
    var baseFingerPosition = this.baseFingerJoint.position;
    var basePalmPosition = this.hand.wrist.position.add(this.hand.up.uniformScale(this.offset));
    var len = this.objectTransforms.length;
    for (var i = 0; i < len; i++) {
        this.objectTransforms[i].setWorldPosition(vec3.lerp(basePalmPosition, baseFingerPosition, i / len));
    }
}

//////////////////////////////////////////////////////////////////////////////////
//
// PUBLIC METHODS - API
//

script.setIntangible = function (value) {
    for (var i = 0; i < script.bodyComponents.length; i++) {
        script.bodyComponents[i].intangible = value;
    }
}

script.setVisible = function (value) {
    script.isVisible = value;
    for (var i = 0; i < script.renderMeshes.length; i++) {
        script.renderMeshes[i].enabled = script.isVisible && script.showMesh;
        script.bodyComponents[i].debugDrawEnabled = script.isVisible && script.showCollider;
    }
}

//////////////////////////////////////////////////////////////////////////////////
//
// "PRIVATE" METHODS
// Doesn't make any sense to call this from another script.
//

// Called on start for each finger
script.createBones = function (prefix, isThumb, offset) {
    for (var i = 0; i < 3; i++) {
        var current = prefix + "-" + i.toFixed(0);
        var jointCollider = new fingerCollider(script.colliderObject, script.hand.getJoint(current), script.getSceneObject());
        script.fingerColliders.push(jointCollider);
        script.colliderObjects.push(jointCollider.object);
        script.renderMeshes.push(jointCollider.object.getComponent("Component.RenderMeshVisual"));
        script.bodyComponents.push(jointCollider.object.getComponent("Physics.BodyComponent"));
        
        var next = prefix + "-" + (i+1).toFixed(0);
        var midCollider = new fingerCollider(script.colliderObject, script.hand.getJoint(current), script.getSceneObject(), script.hand.getJoint(next));
        script.fingerColliders.push(midCollider);
        script.colliderObjects.push(midCollider.object);
        script.renderMeshes.push(midCollider.object.getComponent("Component.RenderMeshVisual"));
        script.bodyComponents.push(midCollider.object.getComponent("Physics.BodyComponent"));
    }


    if (isThumb === true) {
        return;
    }
    
    var baseJoint = prefix + "-0";
    var bone = new palmBone(script.colliderObject, script.hand, script.hand.getJoint(baseJoint), offset, script.getSceneObject());
    script.palmBones.push(bone);
    
    for (var i = 0; i < bone.objects.length; i++) {
        script.colliderObjects.push(bone.objects[i]);
        script.renderMeshes.push(bone.objects[i].getComponent("Component.RenderMeshVisual"));
        script.bodyComponents.push(bone.objects[i].getComponent("Physics.BodyComponent"));
    }
}

// Called after a delay during onTrackingStart
script.enableObjects = function () {
    for (var i = 0; i < script.colliderObjects.length; i++) {
        script.colliderObjects[i].enabled = true;
    }
}

script.handleTrackingStart = function () {
    script.onUpdate = script.createEvent("UpdateEvent");
    script.onUpdate.bind(script.handleUpdate);
    
    // Show the hand after a one frame delay so that objects don't draw in the old position.
    // This issue can persist even if the positions are updated prior to enabling the objects.
    if (script.trackingStartEvent) {
        script.removeEvent(script.trackingStartEvent);
    }
    
    script.trackingStartEvent = script.createEvent("DelayedCallbackEvent");
    script.trackingStartEvent.bind(script.enableObjects);
    script.trackingStartEvent.reset(0.0001);
}

script.handleTrackingStop = function () {
    script.removeEvent(script.onUpdate);
    for (var i = 0; i < script.colliderObjects.length; i++) {
        script.colliderObjects[i].enabled = false;
    }
    // Cancel the tracking start event. Otherwise, it may re-enable itself while untracked.
    if (script.trackingStartEvent) {
        script.removeEvent(script.trackingStartEvent);
    }
}

script.handleUpdate = function () {
    for (var i =0 ; i < script.fingerColliders.length; i++) {
        script.fingerColliders[i].update();
    }

    for (var i =0 ; i < script.palmBones.length; i++) {
        script.palmBones[i].update();
    }
}

//////////////////////////////////////////////////////////////////////////////////
//
// INITIALIZATION
//

script.hand = script.isLeftHand ? global.handTracking.getHand(global.handTracking.HAND_ID.left) : global.handTracking.getHand(global.handTracking.HAND_ID.right);

script.hand.subscribeOnTrackingStart(script.handleTrackingStart);
script.hand.subscribeOnTrackingStop(script.handleTrackingStop);

script.colliderObject.enabled = true;

script.createBones("index", false, 2.5);
script.createBones("mid", false, 1);
script.createBones("ring", false, -1.5);
script.createBones("pinky", false, -2.5);
script.createBones("thumb", true);

script.colliderObject.enabled = false;

script.setVisible(script.startVisible);
script.setIntangible(script.intangible);

// Disable all objects until the hand is tracked
for (var i = 0; i < script.colliderObjects.length; i++) {
    script.colliderObjects[i].enabled = false;
}
