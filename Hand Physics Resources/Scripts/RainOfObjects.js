// RainOfObjects.js
// Version: 0.3.0
// Event: On Awake
// Description: Instantiates scene objects for hand collision.

// @input SceneObject objectToSpawn
// @input float interval = 0.5
// @input float spawnRadius = 8
// @input float spawnHeight = 20

if (script.objectToSpawn === undefined) {
    print("ERROR: Missing reference to objectToSpawn");
    script.getSceneObject().destroy();
    return;
}

script.objectToSpawn.enabled = false;

script.timer = 0;
script.objects = [];
script.killHeight = 0;

script.spawnObject = function (basePosition) {
    var theta = (-script.spawnRadius/2) + (Math.random() * script.spawnRadius);
    var position = basePosition.add(vec3.right().uniformScale(Math.cos(theta)));
    position = position.add(vec3.back().uniformScale(Math.sin(theta)));
    
    var rotation = quat.fromEulerAngles(Math.random() * 180, Math.random() * 180, Math.random() * 180);
    var obj = script.getSceneObject().getParent().copyWholeHierarchy(script.objectToSpawn);
    obj.getTransform().setWorldPosition(position);
    obj.getTransform().setWorldRotation(rotation);
    obj.enabled = true;
    script.objects.push(obj);
}

script.createEvent("UpdateEvent").bind(function () {
    var hand = global.handTracking.getHand();
    if (hand !== undefined) {
        script.timer += getDeltaTime();
        if (script.timer > script.interval) {
            script.timer = 0;
            var spawnPosition = hand.palmCenter.add(vec3.up().uniformScale(script.spawnHeight));
            script.spawnObject(spawnPosition);
        }
        script.killHeight = hand.palmCenter.add(vec3.down().uniformScale(100));
    }

    for (var i = script.objects.length - 1; i >= 0; i--) {
        if (script.objects[i].getTransform().getWorldPosition().y < script.killHeight) {
            var obj = script.objects[i];
            obj.destroy();
            script.objects.splice(i, 1);
        }
    }
});
