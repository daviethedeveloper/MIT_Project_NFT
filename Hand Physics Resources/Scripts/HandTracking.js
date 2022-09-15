// HandTracking.js
// Version: 0.3.0
// Event: On Awake
// Description: Readable code layer for hand tracking experiences.

//@ui {"widget":"group_start", "label":"LeftHand"}
// @input Component.ObjectTracking3D handTrackingLeft {"label":"Hand Tracking"}
// @input bool enableLeftHandOccluder {"label":"Enable Occluder"}
// @input SceneObject leftHandMesh {"showIf":"enableLeftHandOccluder"}
//@ui {"widget":"group_end"}

//@ui {"widget":"group_start", "label":"RightHand"}
// @input Component.ObjectTracking3D handTrackingRight {"label":"Hand Tracking"}
// @input bool enableRightHandOccluder {"label":"Enable Occluder"}
// @input SceneObject rightHandMesh {"showIf":"enableRightHandOccluder"}
//@ui {"widget":"group_end"}

// Verify this object is a child of a perspective camera
var parentObject = script.getSceneObject().getParent();
var foundCamera = false;
while (foundCamera === false && parentObject !== null) {
    if (parentObject.getComponent("Component.Camera")) {
        foundCamera = true;
    }
    else {
        parentObject = parentObject.getParent();
    }
}
if (foundCamera === false) {
    print("Error: Place Hand Physics object under Camera object");
}
else {
    if (parentObject.getComponent("Component.Camera").type !== Camera.Type.Perspective) {
        print("Error: Hand Physics object must be a child of a Perspective camera");
    }
}

global.handTracking = script;
script.HAND_ID = { left: "left", right: "right" };
script.FINGER_ID = { index: "index", middle: "middle", ring: "ring", pinky: "pinky", thumb: "thumb" };
const JOINT_NAMES = ["wrist","thumb-0","thumb-1","thumb-2","thumb-3","index-0","index-1","index-2","index-3","mid-0","mid-1","mid-2","mid-3","ring-0","ring-1","ring-2","ring-3","pinky-0","pinky-1","pinky-2","pinky-3","wrist_to_thumb","wrist_to_index","wrist_to_mid","wrist_to_ring","wrist_to_pinky"];

//////////////////////////////////////////////////////////////////////////////////
//
// JOINT OBJECT
// Intakes raw tracking data and refines it.
//
// # Constructor
// new joint (ObjectTracking3D handTracking, String name) - Creates a new Joint instance. Name must be found in JOINT_NAMES.
//
// # Methods
// update () : void - Called by the hand object.
//
// # Properties
// name : String - The name of this joint
// object : SceneObject - The scene object attached to this joint
// objectTransform : SceneTransform - The scene transform of this joint's scene object.
// position : vec3 - World position of this joint.
// rotation : quat - World rotation of this joint.
// localRotationRaw : vec3 - Local rotation of joint based on raw tracking data.
// localRotation : vec3 - Local vec3 rotation of joint.
//

global.joint = function (handTracking, name) {
    this.name = name;
    this.object = handTracking.createAttachmentPoint(this.name);
    this.objectTransform = this.object.getTransform();
    this.update();
}

global.joint.prototype.update = function () {
    this.position = this.objectTransform.getWorldPosition();
    this.rotation = this.objectTransform.getWorldRotation();
    this.localRotationRaw = this.objectTransform.getLocalRotation().toEulerAngles();
    var localRot = this.localRotationRaw.uniformScale(180 / Math.PI);
    localRot.x = localRot.x % 180;
    localRot.y = localRot.y % 180;
    localRot.z = localRot.z % 180;
    this.localRotation = localRot;    
}

//////////////////////////////////////////////////////////////////////////////////
//
// FINGER OBJECT
// A collection of joints with methods and properties that enhance prototyping speed.
//
// # Constructor
// new finger (Object hand, String jointPrefix, bool isThumb) - Creates a new Finger instance. jointPrefix is determined by JOINT_NAMES.
//
// # Methods
// getCurl () : float - Returns normalized 0..1 value indicating amount of curl, with 0 meaning the finger is straight and 1 meaning tightly clenched. 
// getJoint (Number id) : Object - Returns specified joint object by number (0 = base, 3 = tip). Default 3.
// getRay () : vec3 - Returns world direction indicating where the finger is pointing.
// 
// # Properties
// base : Object - Returns joint 0 (joint 1 for thumb).
// isThumb : bool - Whether or not this finger is a thumb.
// tip : Object - Returns joint 3. 
//

global.finger = function (hand, jointName, isThumb) {
    this.joints = [];
    for (var jointIndex = 0; jointIndex < 4; jointIndex++) {
        this.joints.push(hand.getJoint(jointName + "-" + jointIndex));
    }
    
    this.isThumb = isThumb;
    this.base = this.isThumb ? this.joints[1] : this.joints[0];
    this.tip = this.joints[3];
}

// Returns float 0.1 indicating amount of curl, with 0 meaning the finger is straight and 1 meaning tightly clenched.
// Note that fingers with "upward arcs" when extended will register as _greater_ than 0 ("non-straight").
global.finger.prototype.getCurl = function () {
    // Dot product of (base to middle knuckle) and (last knuckle to tip)
    var baseBoneDirection = this.joints[1].position.sub(this.joints[0].position).normalize()
    var tipBoneDirection = this.joints[3].position.sub(this.joints[2].position).normalize()
    var dot = baseBoneDirection.dot(tipBoneDirection);

    // Normalize and invert the dot product, as its raw value is -1 (clenched) to 1 (straight)
    var curl = 1 - ((dot + 1) / 2);
    
    // MAGIC NUMBER
    // The thumb has a different structure than other fingers, so remap its value on a 0..0.7 scale
    if (this.isThumb) {
        curl = Math.min(curl, 0.7) / 0.7;
    }
    
    return curl;
}

// Returns joint object of the specified id. If id is undefined, it defaults to 3 (tip).
global.finger.prototype.getJoint = function (id) {
    return id === undefined ? this.joints[3] : this.joints[id];
}

// Returns a normalized world vec3 indicating the direction the finger is pointing.
// This will be refined over time.
global.finger.prototype.getRay = function () {
    // Direction of last knuckle to tip
    return (this.joints[3].position.sub(this.joints[2].position).normalize());
}

//////////////////////////////////////////////////////////////////////////////////
//
// HAND OBJECT
//
// # Constructor
// new hand (ObjectTracking3D handTracking, bool isLeftHand)
//
// # Methods
// getFinger (string name) : Object - Get finger by name. Name must be found in FINGER_ID.
// getJoint (String name) : Object - Get joint by name. Name must be found in JOINT_NAMES.
// subscribeOnTrackingStart (function callback) : void - Calls specified function when hand starts tracking.
// subscribeOnTrackingStop (function callback) : void - Calls specified function when hand stops tracking
//
// # Properties
// back : vec3 - Back direction of hand, from knuckle to wrist.
// down : vec3 - Down direction of hand, across the palm from thumb to base.
// forward : vec3 - Forward direction of hand, from wrist to knuckle.
// handTracking : ObjectTracking3D - Component that provides tracking data.
// isLeftHand : bool - Whether or not this is the left hand.
// indexFinger : Object - Returns finger object.
// left : vec3 - Left direction depends on hand: for left hand it is top of hand outwward, for right hand it is outward from palm.
// middleFinger : Object - Returns finger object.
// palmCenter : vec3 - World position of the palm's center.
// pinky : Object - Returns finger object.
// right : vec3 - Right direction depends on hand: for left hand it is outward from palm, for right hand it is top of hand outward.
// ringFinger : Object - Returns finger object.
// rotation : quat - World rotation of the hand. Forward is wrist to fingertip. Up is across palm, from base to thumb.
// thumb : Object - Returns finger object.
// up : vec3 - Up direction of hand, across the palm from base towards thumb.
// width : float - Width of palm, measured from base of index to base of pinky. Not a constant.
// wrist : Object - Returns joint object.
//

global.hand = function (handTracking, handMesh, showHandMesh, isLeftHand) {
    this.handTracking = handTracking;
    this.isLeftHand = isLeftHand;
    this.onTrackingStart = [];
    this.onTrackingStop = [];
    
    // Initialize joint objects
    this.joints = [];
    this.jointMap = new Object();
    for (var i = 0; i < JOINT_NAMES.length; i++) {
        var joint = new global.joint(this.handTracking, JOINT_NAMES[i]);
        this.joints.push(joint);
        this.jointMap[JOINT_NAMES[i]] = joint;
    }
    
    // Create an easy reference to the wrist joint
    this.wrist = this.jointMap["wrist"];
    
    // Initialize finger objects
    this.indexFinger = new global.finger(this, "index", false);
    this.middleFinger = new global.finger(this, "mid", false);
    this.ringFinger = new global.finger(this, "ring", false);
    this.pinky = new global.finger(this, "pinky", false);
    this.thumb = new global.finger(this, "thumb", true);

    // Initialize finger map that enables data-driven scripts
    this.fingerMap = new Object();
    this.fingerMap["index"] = this.indexFinger;
    this.fingerMap["middle"] = this.middleFinger;
    this.fingerMap["ring"] = this.ringFinger;
    this.fingerMap["pinky"] = this.pinky;
    this.fingerMap["thumb"] = this.thumb;

    if (handMesh !== undefined) {
        this.handMesh = handMesh;
        this.showHandMesh = showHandMesh;
        this.handMesh.enabled = showHandMesh;
    }
}

global.hand.prototype.getFinger = function (name) {
    return this.fingerMap[name];
}

global.hand.prototype.getJoint = function (name) {
    return this.jointMap[name];
}

global.hand.prototype.subscribeOnTrackingStart = function (func) {
    this.onTrackingStart.push(func);    
}

global.hand.prototype.subscribeOnTrackingStop = function (func) {
    this.onTrackingStop.push(func);
}

global.hand.prototype.update = function () {
    var wasTracking = this.isTracking;
    this.isTracking = this.handTracking.isTracking();
    
    this.lastUpdateDate = getTime();    
    
    // Tracking has stopped.
    if (wasTracking && !this.isTracking) {
        for (var eventIndex = 0; eventIndex < this.onTrackingStop.length; eventIndex++) {
            this.onTrackingStop[eventIndex]();
        }
    }

    // Early exit if not tracking
    if (this.isTracking == false) {
        return;
    }
    
    for (var i = 0; i < this.joints.length; i++) {
        this.joints[i].update();
    }

    // Tracking has started. Raise the event after joints have updated.
    if (!wasTracking && this.isTracking) {
        for (var eventIndex = 0; eventIndex < this.onTrackingStart.length; eventIndex++) {
            this.onTrackingStart[eventIndex]();
        }
        
        if (this.handMesh !== undefined) {
            this.handMesh.enabled = this.showHandMesh;
        }
    }
}

Object.defineProperty(global.hand.prototype, 'back', {
    get: function () {
        this._back = this.rotation.multiplyVec3(vec3.back());
        return this._back;
    }
});

Object.defineProperty(global.hand.prototype, 'down', {
    get: function () {
        this._down = this.rotation.multiplyVec3(vec3.down());
        return this._down;
    }
});

Object.defineProperty(global.hand.prototype, 'forward', {
    get: function () {
        this._forward = this.rotation.multiplyVec3(vec3.forward());
        return this._forward;
    }
});

Object.defineProperty(global.hand.prototype, 'left', {
    get: function () {
        this._left = this.rotation.multiplyVec3(vec3.left());
        return this._left;
    }
});

Object.defineProperty(global.hand.prototype, 'palmCenter', {
    get: function () {
        // Compute palm center only if we have new data
        if (this._palmCenter === undefined || getTime() > this.lastPalmCenterUpdateTime) {
            this.lastPalmCenterUpdateTime = getTime();
            var wrist = this.wrist.position;
            var indexBase = this.indexFinger.base.position;
            var pinkyBase = this.pinky.base.position;
            this._palmCenter = (wrist.add(indexBase).add(pinkyBase)).uniformScale(1/3);
        }
        return this._palmCenter;
    }
});

Object.defineProperty(global.hand.prototype, 'right', {
    get: function () {
        this._right = this.rotation.multiplyVec3(vec3.left());
        return this._right;
    }
});

Object.defineProperty(global.hand.prototype, 'rotation', {
    get: function () {
        // Compute palm rotation only if we have new data
        if (this._rotation === undefined || getTime() > this.lastPalmRotationUpdateTime) {
            this.lastPalmRotationUpdateTime = getTime();
            var baseMiddleAndRing = this.middleFinger.base.position.add(this.ringFinger.base.position).uniformScale(0.5);    
            var basePalm = this.wrist.position;
            var baseIndex = this.indexFinger.base.position;    
            var z = (baseMiddleAndRing.sub(basePalm)).normalize();
            var x = ((baseIndex.sub(basePalm)).normalize()).cross(z);
            var y = z.cross(x);
			this._rotation = quat.lookAt(z, y);
        }
        return this._rotation;
    }
});

Object.defineProperty(global.hand.prototype, 'up', {
    get: function () {
        this._up = this.rotation.multiplyVec3(vec3.up());
        return this._up;
    }
});

Object.defineProperty(global.hand.prototype, 'width', {
    get: function () {
        return this.indexFinger.base.position.distance(this.pinky.base.position);
    }
});

//////////////////////////////////////////////////////////////////////////////////
//
// HAND TRACKING
//
// # Methods
// getHand (String handId) : Object - Returns hand optionally specified as HAND_ID.left or HAND_ID.right. If handId is undefined, returns hand that is currently tracked.
//
// # Properties
// leftHand : Object - Hand object for left hand.
// rightHand : Object - Hand object for right hand.
//

script.leftHand = new global.hand(script.handTrackingLeft, script.leftHandMesh, script.enableLeftHandOccluder, true);
script.rightHand = new global.hand(script.handTrackingRight, script.rightHandMesh, script.enableRightHandOccluder, false);

// By default, returns the hand that is currently tracked, since only one is tracked at a time.
global.handTracking.getHand = function (handId) {
    if (handId === undefined) {
        if (script.leftHand.isTracking) {
            return script.leftHand;
        }
        if (script.rightHand.isTracking) {
            return script.rightHand;        
        }
    }
    else {
        if (handId === script.HAND_ID.left) {
            return script.leftHand;
        }
        if (handId == script.HAND_ID.right) {
            return script.rightHand;
        }
    }
    return undefined;
}

script.createEvent("UpdateEvent").bind(function () {
    script.leftHand.update();    
    script.rightHand.update();    
});
