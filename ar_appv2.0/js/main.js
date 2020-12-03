
var canvas = document.getElementById("renderCanvas"); // Get the canvas element
// var engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function () { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true});};

// const xrPolyfillPromise = new Promise((resolve) => {
//     if (navigator.xr) {
//         return resolve();
//     }
//     define('polyfill', ['https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js'], (polyfill) => { new polyfill(); resolve(); });
// });

/******* Add the create scene function ******/
var createScene = async function () {

    var scene = new BABYLON.Scene(engine);
        
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);

    camera.setTarget(BABYLON.Vector3.Zero());

    camera.attachControl(canvas, true);

    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    light.intensity = 0.7;

    var dirLight = new BABYLON.DirectionalLight('light', new BABYLON.Vector3(0, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(0, 5, -5);

    var shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    const model = await BABYLON.SceneLoader.ImportMeshAsync("", "./scenes/", "dummy3.babylon", scene);

    var xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: "immersive-ar",
            referenceSpaceType: "local-floor"
        },
        optionalFeatures: true
    });

    const fm = xr.baseExperience.featuresManager;

    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const xrPlanes = fm.enableFeature(BABYLON.WebXRPlaneDetector.Name, "latest");
    const anchors = fm.enableFeature(BABYLON.WebXRAnchorSystem.Name, 'latest');

    const xrBackgroundRemover = fm.enableFeature(BABYLON.WebXRBackgroundRemover.Name);

    let b = model.meshes[0];//BABYLON.CylinderBuilder.CreateCylinder('cylinder', { diameterBottom: 0.2, diameterTop: 0.4, height: 0.5 });
    b.rotationQuaternion = new BABYLON.Quaternion();
    // b.isVisible = false;
    shadowGenerator.addShadowCaster(b, true);

    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05 });
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();

    var skeleton = model.skeletons[0];

    // ROBOT
    skeleton.animationPropertiesOverride = new BABYLON.AnimationPropertiesOverride();
    skeleton.animationPropertiesOverride.enableBlending = true;
    skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
    skeleton.animationPropertiesOverride.loopMode = 1;

    var idleRange = skeleton.getAnimationRange("YBot_Idle");
    var walkRange = skeleton.getAnimationRange("YBot_Walk");
    var runRange = skeleton.getAnimationRange("YBot_Run");
    var leftRange = skeleton.getAnimationRange("YBot_LeftStrafeWalk");
    var rightRange = skeleton.getAnimationRange("YBot_RightStrafeWalk");
    scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true);

    let hitTest;

    b.isVisible = false;

    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true;
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, b.rotationQuaternion, b.position);
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });
    const mat1 = new BABYLON.StandardMaterial('1', scene);
    mat1.diffuseColor = BABYLON.Color3.Red();
    const mat2 = new BABYLON.StandardMaterial('1', scene);
    mat2.diffuseColor = BABYLON.Color3.Blue();

    if (anchors) {
        console.log('anchors attached');
        anchors.onAnchorAddedObservable.add(anchor => {
            console.log('attaching', anchor);
            b.isVisible = true;
            anchor.attachedNode = b.clone("mensch");
            anchor.attachedNode.skeleton = skeleton.clone('skelet');
            shadowGenerator.addShadowCaster(anchor.attachedNode, true);
            scene.beginAnimation(anchor.attachedNode.skeleton, idleRange.from, idleRange.to, true);
            b.isVisible = false;
        })

        anchors.onAnchorRemovedObservable.add(anchor => {
            console.log('disposing', anchor);
            if (anchor) {
                anchor.attachedNode.isVisible = false;
                anchor.attachedNode.dispose();
            }
        });
    }

    scene.onPointerDown = (evt, pickInfo) => {
        if (hitTest && anchors && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            anchors.addAnchorPointUsingHitTestResultAsync(hitTest);
        }
    }

    const planes = [];

    xrPlanes.onPlaneAddedObservable.add(plane => {
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        plane.mesh = polygon; //BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = (plane.mesh);
        const mat = new BABYLON.StandardMaterial("mat", scene);
        mat.alpha = 0.5;
        mat.diffuseColor = BABYLON.Color3.Random();
        polygon.createNormals();
        // polygon.receiveShadows = true;
        plane.mesh.material = mat;

        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
    });

    xrPlanes.onPlaneUpdatedObservable.add(plane => {
        let mat;
        if (plane.mesh) {
            mat = plane.mesh.material;
            plane.mesh.dispose(false, false);
        }
        const some = plane.polygonDefinition.some(p => !p);
        if (some) {
            return;
        }
        plane.polygonDefinition.push(plane.polygonDefinition[0]);
        var polygon_triangulation = new BABYLON.PolygonMeshBuilder("name", plane.polygonDefinition.map((p) => new BABYLON.Vector2(p.x, p.z)), scene);
        var polygon = polygon_triangulation.build(false, 0.01);
        polygon.createNormals();
        plane.mesh = polygon;// BABYLON.TubeBuilder.CreateTube("tube", { path: plane.polygonDefinition, radius: 0.02, sideOrientation: BABYLON.Mesh.FRONTSIDE, updatable: true }, scene);
        //}
        planes[plane.id] = (plane.mesh);
        plane.mesh.material = mat;
        plane.mesh.rotationQuaternion = new BABYLON.Quaternion();
        plane.transformationMatrix.decompose(plane.mesh.scaling, plane.mesh.rotationQuaternion, plane.mesh.position);
        plane.mesh.receiveShadows = true;
    })

    xrPlanes.onPlaneRemovedObservable.add(plane => {
        if (plane && planes[plane.id]) {
            planes[plane.id].dispose()
        }
    })
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        planes.forEach(plane => plane.dispose());
        while (planes.pop()) { };
    });
    return scene;

};
/******* End add the create scene function ******/
var engine;
try {
engine = createDefaultEngine();
} catch(e) {
console.log("the available createEngine function failed. Creating the default engine instead");
engine = createDefaultEngine();
}
if (!engine) throw 'engine should not be null.';
scene = createScene();;
scene.then(returnedScene => { sceneToRender = returnedScene; });


engine.runRenderLoop(function () {
    if (sceneToRender && sceneToRender.activeCamera) {
        sceneToRender.render();
    }
});

/************* engine for VR use ****************/
// var scene = createScene(); //Call the createScene function

// Register a render loop to repeatedly render the scene
// engine.runRenderLoop(function () {
//         scene.render();
// });

// Watch for browser/canvas resize events
window.addEventListener("resize", function () {
    engine.resize();
});
