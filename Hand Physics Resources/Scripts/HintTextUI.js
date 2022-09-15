// HelpTextUI.js
// Version: 0.3.0
// Event: On Awake
// Description: Hints for hand tracking and hand colliders.

// @input Component.Text hintText

if (script.hintText == undefined) {
    print("ERROR: Make sure to set Hint Text Component");
    script.getSceneObject().destroy();
    return;
}

script.createEvent("SnapRecordStartEvent").bind(function() {
    script.hintText.enabled = false;
});

script.createEvent("UpdateEvent").bind(function () {
    if (global.handTracking.getHand() === undefined) {
        script.hintText.text = "Show your hand";
    }
    else {
        script.hintText.text = "Tap to hide or show colliders"
    }
});
