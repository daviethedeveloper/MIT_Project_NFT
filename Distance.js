// -----JS CODE-----
// @input SceneObject objectA
// @input SceneObject objectB
// @input Component.Text displayText

script.createEvent("UpdateEvent").bind(function() {
    var a = script.objectA.getTransform().getWorldPosition();
    var b = script.objectB.getTransform().getWorldPosition();
    var dist = a.distance(b);
    
    script.displayText.text = dist.toFixed(0);
})