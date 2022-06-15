const EPS = 0.00001;

var biological_constraints = true;
var mouseInterface = false;
var touchInterface = false;

createScene ();

scene.remove (light);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// PointLight and DirectionaLight make problems with older GPU
var light = new THREE.SpotLight ('white', 0.5);
light.position.set (0, 100, 50);
light.penumbra = 1;
light.shadow.mapSize.width = Math.min (4 * 1024, renderer.capabilities.maxTextureSize / 2);
light.shadow.mapSize.height = light.shadow.mapSize.width;
light.shadow.radius = 2;
light.castShadow = true;
scene.add (light);

var controls = new THREE.OrbitControls (camera, renderer.domElement);

var model = new Male ();
model.l_tips = model.l_fingers.tips;
model.r_tips = model.r_fingers.tips;

// Create gauge indicator
var gauge = new THREE.Mesh (
		new THREE.CircleBufferGeometry (10, 32, 9 / 4 * Math.PI, Math.PI / 2),
		new THREE.MeshPhongMaterial ({
			'side': THREE.DoubleSide,
			'color': 'blue',
			'transparent': true,
			'opacity': 0.75,
			'alphaMap': gaugeTexture ()
		})
	),
	gaugeMaterial = new THREE.MeshBasicMaterial ({ 'color': 'navy' });

gauge.add (new THREE.Mesh (new THREE.TorusBufferGeometry (10, 0.1, 8, 32, Math.PI / 2).rotateZ (Math.PI / 4), gaugeMaterial));
gauge.add (new THREE.Mesh (new THREE.ConeBufferGeometry (0.7, 3, 6).translate (-10, 0, 0).
	rotateZ (5 * Math.PI / 4), gaugeMaterial));
gauge.add (new THREE.Mesh (new THREE.ConeBufferGeometry (0.7, 3, 6).translate (10, 0, 0).
	rotateZ (3 * Math.PI / 4), gaugeMaterial));

function gaugeTexture (size = 256) {
	let canvas = document.createElement ('canvas');

	canvas.width = size;
	canvas.height = size;
	let r = size / 2;

	let ctx = canvas.getContext ('2d');

	ctx.fillStyle = 'black';
	ctx.fillRect (0, 0, size, size);

	let grd = ctx.createRadialGradient (r, r, r / 2, r, r, r);

	grd.addColorStop (0, 'black');
	grd.addColorStop (1, 'gray');

	// Fill with gradient
	ctx.fillStyle = grd;
	ctx.fillRect (1, 1, size - 2, size - 2);

	let start = Math.PI,
		end = 2 * Math.PI;

	ctx.strokeStyle = 'white';
	ctx.lineWidth = 1;
	ctx.beginPath ();

	for (let rr = r; rr > 0; rr -= 25) {
		ctx.arc (size / 2, size / 2, rr, start, end);
	}

	for (let i = 0; i <= 12; i++) {
		ctx.moveTo (r, r);
		let a = start + i / 12 * (end - start);

		ctx.lineTo (r + r * Math.cos (a), r + r * Math.sin (a));
	}

	ctx.stroke ();

	let texture = new THREE.CanvasTexture (canvas, THREE.UVMapping);

	texture.anisotropy = renderer.capabilities.getMaxAnisotropy ();
	texture.repeat.set (1, 1);

	return texture;
}

// Name body parts
var names = [
	'body',
	'pelvis',
	'torso',
	'neck',
	'head',
	'l_leg',
	'l_knee',
	'l_ankle',
	'l_arm',
	'l_elbow',
	'l_wrist',
	'l_fingers',
	'l_tips',
	'r_leg',
	'r_knee',
	'r_ankle',
	'r_arm',
	'r_elbow',
	'r_wrist',
	'r_fingers',
	'r_tips'
];

for (var name of names) {
	for (var part of model[name].children[0].children) {
		part.name = name;
	}

	for (var part of model[name].children[0].children[0].children) {
		part.name = name;
	}

	if (model[name].children[0].children[1]) {
		for (var part of model[name].children[0].children[1].children) {
			part.name = name;
		}
	}
}

var mouse = new THREE.Vector2 (),       // Mouse 3D position
	mouseButton = undefined,            // Pressed mouse buttons
	raycaster = new THREE.Raycaster (), // Raycaster to grab body part
	dragPoint = new THREE.Mesh (),      // Point of grabbing
	obj = undefined;                    // Currently selected body part

var rb_x = document.getElementById ('rb-x'),
	rb_y = document.getElementById ('rb-y'),
	rb_z = document.getElementById ('rb-z'),
	cb_move = document.getElementById ('cb-move'),
	btn_save = document.getElementById ('btn-save'),
	btn_load = document.getElementById ('btn-load'),
	file_load = document.getElementById('file-load');

// Set up event handlers
document.addEventListener ('mousedown',   onMouseDown);
document.addEventListener ('mouseup',     onMouseUp);
document.addEventListener ('mousemove',   onMouseMove);

document.addEventListener ('touchstart',  onMouseDown);
document.addEventListener ('touchend',    onMouseUp);
document.addEventListener ('touchcancel', onMouseUp);
document.addEventListener ('touchmove',   onMouseMove);

rb_z.addEventListener     ('click', processXyz);
rb_x.addEventListener     ('click', processXyz);
rb_y.addEventListener     ('click', processXyz);
cb_move.addEventListener  ('click', onMoveClicked);

btn_save.addEventListener ('click', savePosture);
btn_load.addEventListener ('click', () => { file_load.click(); });
file_load.addEventListener('change', loadPosture);

controls.addEventListener ('start', () => {
	renderer.setAnimationLoop (drawFrame);
});

controls.addEventListener ('end', () => {
	renderer.setAnimationLoop (null);
	renderer.render (scene, camera);
});

window.addEventListener ('resize', () => {
	renderer.render (scene, camera);
});

function onMoveClicked (event) {
	Array.from(document.getElementsByClassName('xyz')).forEach((rb) => {
		rb.classList.toggle('move');
	});
	processXyz();
}

function processXyz (event) {
	if (event) {
		if (event.target.checked) {
			// rb_x.checked = rb_y.checked = rb_y.checked = rb_z.checked = false;
			event.target.checked = true;
		}

		if (touchInterface) {
			event.target.checked = true;
		}
	}

	if ( ! obj) {
		return;
	}

	if (rb_z.checked) {
		obj.rotation.reorder ('XYZ');
	}

	if (rb_x.checked) {
		obj.rotation.reorder ('YZX');
	}

	if (rb_y.checked) {
		obj.rotation.reorder ('ZXY');
	}
}

function onMouseUp (event) {
	controls.enabled = true;
	mouseButton = undefined;
	deselect ();
	renderer.setAnimationLoop (null);
	renderer.render (scene, camera);
}

function select (object) {
	deselect ();
	obj = object;
	obj?.select (true);
}

function deselect () {
	gauge.parent?.remove (gauge);
	obj?.select (false);
	obj = undefined;
}

function onMouseDown (event) {
	userInput (event);

	gauge.parent?.remove (gauge);
	dragPoint.parent?.remove (dragPoint);

	raycaster.setFromCamera (mouse, camera);

	let intersects = raycaster.intersectObject (model, true);

	if (intersects.length && (intersects[0].object.name || intersects[0].object.parent.name)) {
		controls.enabled = false;

		let name = intersects[0].object.name || intersects[0].object.parent.name;

		if (name == 'neck') {
			name = 'head';
		}

		if (name == 'pelvis') {
			name = 'body';
		}

		select (model[name]);

		dragPoint.position.copy (obj.worldToLocal (intersects[0].point));
		obj.imageWrapper.add (dragPoint);

		if ( ! cb_move.checked) {
			obj.imageWrapper.add (gauge);
		}

		gauge.position.y = obj instanceof Ankle ? 2 : 0;

		processXyz ();
	}

	renderer.setAnimationLoop (drawFrame);
}

function relativeTurn (joint, rotationalAngle, value) {
	if ( ! rotationalAngle) {
		// It is translation, not rotation
		if (rb_x.checked) {
			joint.position.x += value;
		} else if (rb_y.checked) {
			joint.position.z += value;
		} else if (rb_z.checked) {
			joint.position.y += value;
		}
		return;
	}

	if (joint.biologicallyImpossibleLevel) {
		if (biological_constraints) {
			// There is a dedicated function to check biological possibility of joint
			let oldImpossibility = joint.biologicallyImpossibleLevel ();

			joint[rotationalAngle] += value;
			joint.updateMatrix ();
			joint.updateWorldMatrix (true); // ! important, otherwise get's stuck

			let newImpossibility = joint.biologicallyImpossibleLevel ();

			if (newImpossibility > EPS && newImpossibility >= oldImpossibility - EPS) {
				// Undo rotation
				joint[rotationalAngle] -= value;

				return;
			}
		} else {
			joint.biologicallyImpossibleLevel ();
			joint[rotationalAngle] += value;
		}
		// Keep the rotation, it is either possible, or improves impossible situation
	} else {
		// There is no dedicated function, test with individual rotation range

		let val = joint[rotationalAngle] + value,
			min = joint.minRot[rotationalAngle],
			max = joint.maxRot[rotationalAngle];

		if (biological_constraints || min == max) {
			if (val < min - EPS && value < 0) {
				return;
			}

			if (val > max + EPS && value > 0) {
				return;
			}

			if (min == max) {
				return;
			}
		}

		joint[rotationalAngle] = val;
	}

	joint.updateMatrix ();
} // RelativeTurn

function kinematic2D (joint, rotationalAngle, angle, ignoreIfPositive) {
	// Returns >0 if this turn gets closer

	// Swap Z<->X for wrist
	if (joint instanceof Wrist) {
		if (rotationalAngle == 'x') {
			rotationalAngle = 'z';
		} else if (rotationalAngle == 'z') {
			rotationalAngle = 'x';
		}
	}

	let screenPoint = new THREE.Vector3 ().copy (dragPoint.position);

	screenPoint = obj.localToWorld (screenPoint).project (camera);

	let distOriginal = mouse.distanceTo (screenPoint),
		oldAngle = joint[rotationalAngle];

	if (joint instanceof Head) { // Head and neck
		oldParentAngle = joint.parentJoint[rotationalAngle];
		relativeTurn (joint, rotationalAngle, angle / 2);
		relativeTurn (joint.parentJoint, rotationalAngle, angle / 2);
		joint.parentJoint.updateMatrixWorld (true);
	} else {
		relativeTurn (joint, rotationalAngle, angle);
	}

	joint.updateMatrixWorld (true);

	screenPoint.copy (dragPoint.position);
	screenPoint = obj.localToWorld (screenPoint).project (camera);

	let distProposed = mouse.distanceTo (screenPoint),
		dist = distOriginal - distProposed;

	if (ignoreIfPositive && dist > 0) {
		return dist;
	}

	joint[rotationalAngle] = oldAngle;

	if (joint instanceof Head) { // Head and neck
		joint.parentJoint[rotationalAngle] = oldParentAngle;
	}

	joint.updateMatrixWorld (true);

	return dist;
}

function inverseKinematics (joint, rotationalAngle, step) {
	// Try going in postive or negative direction
	let kPos = kinematic2D (joint, rotationalAngle, 0.001),
		kNeg = kinematic2D (joint, rotationalAngle, -0.001);

	// If any of them improves closeness, then turn in this direction
	if (kPos > 0 || kNeg > 0) {
		if (kPos < kNeg) {
			step = -step;
		}

		kinematic2D (joint, rotationalAngle, step, true);
	}
}

function animate (time) {
	let inv_knm = false;

	// No selected object
	if ( ! obj || ! mouseButton) {
		return;
	}

	let elemNone = ! rb_z.checked && ! rb_x.checked && ! rb_y.checked && ! cb_move.checked,
		spinA = obj instanceof Ankle ? Math.PI / 2 : 0;

	gauge.rotation.set (0, 0, -spinA);

	if (rb_x.checked || elemNone && mouseButton & 0x2) {
		gauge.rotation.set (0, Math.PI / 2, 2 * spinA);
	}

	if (rb_y.checked || elemNone && mouseButton & 0x4) {
		gauge.rotation.set (Math.PI / 2, 0, -Math.PI / 2);
	}

	let joint = cb_move.checked ? model.body : obj;

	do {
		for (let step = 5; step > 0.1; step *= 0.75) {
			if ( cb_move.checked && obj.name === '') {
				inverseKinematics (joint, '', step); // translate
			} else {
				if (rb_z.checked || elemNone && mouseButton & 0x1) {
					inverseKinematics (joint, 'z', step);
				}

				if (rb_x.checked || elemNone && mouseButton & 0x2) {
					inverseKinematics (joint, 'x', step);
				}

				if (rb_y.checked || elemNone && mouseButton & 0x4) {
					inverseKinematics (joint, 'y', step);
				}
			}
		}

		joint = joint.parentJoint;
		inv_knm = false;
		// do not work:
		// inv_knm = cb_move.checked && obj.name !== '';
	}
	while (joint && ! (joint instanceof Mannequin) && ! (joint instanceof Pelvis) && ! (joint instanceof Torso) && inv_knm);
}

function onMouseMove (event) {
	if (obj) {
		userInput (event);
	}
}

function userInput (event) {
	if (event instanceof MouseEvent) {
		event.preventDefault ();

		mouseInterface = true;
		mouseButton = event.buttons || 0x1;

		mouse.x = event.clientX / window.innerWidth * 2 - 1;
		mouse.y = -event.clientY / window.innerHeight * 2 + 1;
	}

	if (window.TouchEvent && event instanceof TouchEvent && event.touches.length == 1) {
		mouseButton = 0x1;

		touchInterface = true;
		mouse.x = event.touches[0].clientX / window.innerWidth * 2 - 1;
		mouse.y = -event.touches[0].clientY / window.innerHeight * 2 + 1;
	}
}

const dict_keys = [
	'pos',
	'rot',
	'torso',
	'head',
	'l_leg',
	'l_knee',
	'l_ankle',
	'r_leg',
	'r_knee',
	'r_ankle',
	'l_arm',
	'l_elbow',
	'l_wrist',
	'l_fingers',
	'r_arm',
	'r_elbow',
	'r_wrist',
	'r_fingers'
];

function postureToDict(posture) {
	posture_dict = {};
	posture.forEach((pos, index) => {
		posture_dict[dict_keys[index]] = pos;
	});
	posture_dict['pos'] = [0, posture_dict['pos'], 0];
	return posture_dict;
}

function dictToPosture(posture_dict) {
	posture = [];
	dict_keys.map( (key, index) => {
		posture[index] = posture_dict[key];
	});
	posture[0] = posture[0][1];
	return posture;
}

function savePosture () {
	let pose = {
		title: '',
		aliases: [],
		wtf_version: 0.1,
		mannequin_version: model.posture.version,
		description: '',
		activity: 'acroyoga',
		keywords: [],
		difficulty: 1,
		author: '',
		source: '',
		camera: {
			pos: [ 0, 0, 0 ],
			rot: [ 0, 0, 0 ]
		},
		posture: {
			base: postureToDict(model.posture.data),
			fly: {},
			spot: {}
		},
		comment: ''
	};

	let yaml_posture = YAML.stringify(pose, 3, 2);
	posture_name = window.prompt('Chose posture name:', 'my_posture');
	downloadBlob(yaml_posture, posture_name + '.wtfp.yml');
}

function downloadBlob(content, name) {
	const blobUrl = URL.createObjectURL(new Blob([ content ], {
		type : 'text/yaml'
	}));

	const link = document.createElement('a');
	link.style = 'display: none';
	link.href = blobUrl;
	link.download = name;

	document.body.appendChild(link);

	link.dispatchEvent(
		new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
	);

	document.body.removeChild(link);
}

function loadPosture (file_load) {
	const char_loaded = 'base';
	var reader = new FileReader();
	var file = file_load.target.files[0];

	if (! file.name.endsWith('wtfp.yml')) {
		alert('Wrong file extension.');
		return
	} else if (file.type != 'application/x-yaml') {
		alert('Wrong file type.');
		return;
	} else if (file.size > 5000) {
		alert('File too big.');
		return;
	}

	reader.readAsText(file, 'UTF-8');
	reader.onload = readerEvent => {
		let pose = YAML.parse(readerEvent.target.result);

		let posture = {
			'version': pose.mannequin_version,
			'data': dictToPosture(pose.posture[char_loaded])
		}

		let oldPosture = model.posture;

		try {
			model.postureString = JSON.stringify(posture);
		} catch (error) {
			model.posture = oldPosture;

			if (error instanceof MannequinPostureVersionError) {
				alert (error.message);
			} else {
				alert ('The provided posture was either invalid or impossible to understand.');
			}
			console.error (error);
		}
		renderer.render (scene, camera);
	}
}
