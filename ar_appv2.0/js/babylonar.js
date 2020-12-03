var createScene = async function () {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera(
        "camera1",
        new BABYLON.Vector3(0, 5, -10),
        scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    var light = new BABYLON.HemisphericLight(
        "light1",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = 0.7;
    var sphere = BABYLON.Mesh.CreateSphere("sphere1", 16, 2, scene);
    sphere.position.y = 2;
    sphere.position.z = 5;

    const xr = await scene.createDefaultXRExperienceAsync({
        // ask for an ar-session
        uiOptions: {
            sessionMode: "immersive-ar",
        },
        optionalFeatures : true,
    });

    const hitTest = featuresManager.enableFeature(BABYLON.WebXRHitTest, "latest");
    const anchorSystem = featuresManager.enableFeature(BABYLON.WebXRAnchorSystem, 'latest', {doNotRemoveAnchorsOnSessionEnded: true});
    const arTestResult = getMeTheResultINeed();
    const anchorPromise = anchorSystem.addAnchorPointUsingHitTestResultAsync(lastHitTest);

    // a dot to show in the found position
    const dot = BABYLON.SphereBuilder.CreateSphere(
        "dot",
        {
            diameter: 0.05,
        },
        scene
    );
    dot.isVisible = false;
    hitTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            dot.isVisible = true;
            results[0].transformationMatrix.decompose(
                dot.scaling,
                dot.rotationQuaternion,
                dot.position
            );
        } else {
        dot.isVisible = false;
        }
    });

    anchorSystem.onAnchorAddedObservable.add((anchor) => {

    })

    anchorSystem.onAnchorRemovedObservable.add((anchor) => {

    })

    anchorSystem.onAnchorUpdatedObservable.add((anchor) => {

    })

    return scene;
};