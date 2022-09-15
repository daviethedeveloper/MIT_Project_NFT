// -----JS CODE-----
// ToggleJointVisibility.js
// Version: 0.3.0
// Event: On Awake
// Description: Toggles visibility on target Hand Colliders objects

// @input Component.ScriptComponent handCollidersL
// @input Component.ScriptComponent handCollidersR

script.createEvent("TapEvent").bind(function () {
    var isVisible = !script.handCollidersL.isVisible;
    script.handCollidersL.setVisible(isVisible);
    script.handCollidersR.setVisible(isVisible);
});
