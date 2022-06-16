const epsilon          = 0.00001,
	  bio_constraints  = true,
	  rb_x             = document.getElementById( 'rb-x' ),
	  rb_y             = document.getElementById( 'rb-y' ),
	  rb_z             = document.getElementById( 'rb-z' ),
	  cb_move          = document.getElementById( 'cb-move' ),
	  btn_save         = document.getElementById( 'btn-save' ),
	  btn_load         = document.getElementById( 'btn-load' ),
	  file_load        = document.getElementById( 'file-load' )

let mouse              = new THREE.Vector2(),   // Mouse 3D position
	pressed_mouse_btn,                          // Pressed mouse buttons
	raycaster          = new THREE.Raycaster(), // Raycaster to grab body part
	drag_point         = new THREE.Mesh(),      // Point of grabbing
	selected_body_part,                         // Currently selected body part

	mouse_interface    = false,
	touch_interface    = false

createScene()

var controls = new THREE.OrbitControls( camera, renderer.domElement ),
	gauge    = createGauge()
	models   = {
		'base' : new Mannequin(),
		'flyer': new Mannequin(),
	}

setInitialPosition(models)
renameModelsParts(models)
setupEventHandlers()

function createGauge() {
	let gauge = new THREE.Mesh(
		new THREE.CircleBufferGeometry( 10, 32, 9 / 4 * Math.PI, Math.PI / 2 ),
		new THREE.MeshPhongMaterial( {
			'side':        THREE.DoubleSide,
			'color':       'blue',
			'transparent': true,
			'opacity':     0.75,
			'alphaMap':    gaugeTexture()
		} )
	)

	let gaugeMaterial = new THREE.MeshBasicMaterial( {
		'color': 'navy'
	} )

	gauge.add( new THREE.Mesh( new THREE.TorusBufferGeometry( 10, 0.1, 8, 32, Math.PI / 2 )
		.rotateZ( Math.PI / 4 ), gaugeMaterial )
	)

	gauge.add( new THREE.Mesh( new THREE.ConeBufferGeometry( 0.7, 3, 6 )
		.translate( - 10, 0, 0 )
		.rotateZ( 5 * Math.PI / 4 ), gaugeMaterial )
	)

	gauge.add( new THREE.Mesh( new THREE.ConeBufferGeometry( 0.7, 3, 6 )
		.translate( 10, 0, 0 )
		.rotateZ( 3 * Math.PI / 4 ), gaugeMaterial )
	)

	return gauge
}

function gaugeTexture( size = 256 ) {
	let canvas = document.createElement( 'canvas' )

	canvas.width = size
	canvas.height = size
	let r = size / 2

	let ctx = canvas.getContext( '2d' )

	ctx.fillStyle = 'black'
	ctx.fillRect( 0, 0, size, size )

	let grd = ctx.createRadialGradient( r, r, r / 2, r, r, r )

	grd.addColorStop( 0, 'black' )
	grd.addColorStop( 1, 'gray' )

	// Fill with gradient
	ctx.fillStyle = grd
	ctx.fillRect( 1, 1, size - 2, size - 2 )

	let start = Math.PI,
		end = 2 * Math.PI

	ctx.strokeStyle = 'white'
	ctx.lineWidth = 1
	ctx.beginPath()

	for ( let rr = r; rr > 0; rr -= 25 ) {
		ctx.arc( size / 2, size / 2, rr, start, end )
	}

	for ( let i = 0; i <= 12; i ++ ) {
		ctx.moveTo( r, r )
		let a = start + i / 12 * ( end - start )

		ctx.lineTo( r + r * Math.cos( a ), r + r * Math.sin( a ) )
	}

	ctx.stroke()

	let texture = new THREE.CanvasTexture( canvas, THREE.UVMapping )

	texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
	texture.repeat.set( 1, 1 )

	return texture
}

function setInitialPosition(models) {
	models.base.body.position.x  -= 15
	models.flyer.body.position.x += 15
	models.base.body.position.y  += 4
	models.flyer.body.position.y += 4
}

function renameModelsParts( models ) {
	const body_parts = [
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
	]

	for (let [model_name, model] of Object.entries(models)) {
		model.label = model_name
		model.l_tips = model.l_fingers.tips
		model.r_tips = model.r_fingers.tips

		for ( let name of body_parts ) {
			for ( var part of model[name].children[0].children ) {
				part.name = name
			}

			for ( var part of model[name].children[0].children[0].children ) {
				part.name = name
			}

			if ( model[name].children[0].children[1] ) {
				for ( var part of model[name].children[0].children[1].children ) {
					part.name = name
				}
			}
		}
	}
}

function setupEventHandlers() {
	document.addEventListener( 'mousedown', onMouseDown )
	document.addEventListener( 'mouseup', onMouseUp )
	document.addEventListener( 'mousemove', onMouseMove )

	document.addEventListener( 'touchstart', onMouseDown )
	document.addEventListener( 'touchend', onMouseUp )
	document.addEventListener( 'touchcancel', onMouseUp )
	document.addEventListener( 'touchmove', onMouseMove )

	rb_z.addEventListener( 'click', processXyz )
	rb_x.addEventListener( 'click', processXyz )
	rb_y.addEventListener( 'click', processXyz )
	cb_move.addEventListener( 'click', onMoveClicked )

	btn_save.addEventListener( 'click', savePosture )
	btn_load.addEventListener( 'click', () => {
		file_load.click()
	} )
	file_load.addEventListener( 'change', loadPosture )

	controls.addEventListener( 'start', () => {
		renderer.setAnimationLoop( drawFrame )
	} )

	controls.addEventListener( 'end', () => {
		renderer.setAnimationLoop( null )
		renderer.render( scene, camera )
	} )

	window.addEventListener( 'resize', () => {
		renderer.render( scene, camera )
	} )
}

function onMoveClicked( event ) {
	Array.from( document.getElementsByClassName( 'xyz' ) ).forEach( ( rb ) => {
		rb.classList.toggle( 'move' )
	} )
	processXyz()
}

function processXyz( event ) {
	if ( event ) {
		if ( event.target.checked ) {
			// Rb_x.checked = rb_y.checked = rb_y.checked = rb_z.checked = false;
			event.target.checked = true
		}

		if ( touch_interface ) {
			event.target.checked = true
		}
	}

	if ( ! selected_body_part ) {
		return
	}

	if ( rb_z.checked ) {
		selected_body_part.rotation.reorder( 'XYZ' )
	}

	if ( rb_x.checked ) {
		selected_body_part.rotation.reorder( 'YZX' )
	}

	if ( rb_y.checked ) {
		selected_body_part.rotation.reorder( 'ZXY' )
	}
}

function onMouseUp( event ) {
	controls.enabled = true
	pressed_mouse_btn = undefined
	deselect()
	renderer.setAnimationLoop( null )
	renderer.render( scene, camera )
}

function select( object ) {
	deselect()
	selected_body_part = object
	selected_body_part?.select( true )
}

function deselect() {
	gauge.parent?.remove( gauge )
	selected_body_part?.select( false )
	selected_body_part = undefined
}

function onMouseDown( event ) {
	userInput( event )

	gauge.parent?.remove( gauge )
	drag_point.parent?.remove( drag_point )

	raycaster.setFromCamera( mouse, camera )

	let intersects
	Object.values(models).forEach(model => {
		intersects = raycaster.intersectObject( model, true )
		if ( intersects.length && ( intersects[0].object.name || intersects[0].object.parent.name ) ) {
			onModelClicked(model, intersects)
		}
	});

	renderer.setAnimationLoop( drawFrame )
}

function onModelClicked(model, intersects) {
	controls.enabled = false

	let name = intersects[0].object.name || intersects[0].object.parent.name

	if ( name == 'neck' ) {
		name = 'head'
	}

	if ( name == 'pelvis' ) {
		name = 'body'
	}

	select( model[name] )

	drag_point.position.copy( selected_body_part.worldToLocal( intersects[0].point ) )
	selected_body_part.imageWrapper.add( drag_point )

	if ( ! cb_move.checked ) {
		selected_body_part.imageWrapper.add( gauge )
	}

	gauge.position.y = selected_body_part instanceof Ankle ? 2 : 0

	processXyz()
}

function relativeTurn( joint, rotationalAngle, value ) {
	if ( ! rotationalAngle ) {
		// It is translation, not rotation
		if ( rb_x.checked ) {
			joint.position.x += value
		} else if ( rb_y.checked ) {
			joint.position.z += value
		} else if ( rb_z.checked ) {
			joint.position.y += value
		}

		return
	}

	if ( joint.biologicallyImpossibleLevel ) {
		if ( bio_constraints ) {
			// There is a dedicated function to check biological possibility of joint
			let oldImpossibility = joint.biologicallyImpossibleLevel()

			joint[rotationalAngle] += value
			joint.updateMatrix()
			joint.updateWorldMatrix( true ) // ! important, otherwise get's stuck

			let newImpossibility = joint.biologicallyImpossibleLevel()

			if ( newImpossibility > epsilon && newImpossibility >= oldImpossibility - epsilon ) {
				// Undo rotation
				joint[rotationalAngle] -= value

				return
			}
		} else {
			joint.biologicallyImpossibleLevel()
			joint[rotationalAngle] += value
		}
		// Keep the rotation, it is either possible, or improves impossible situation
	} else {
		// There is no dedicated function, test with individual rotation range

		let val = joint[rotationalAngle] + value,
			min = joint.minRot[rotationalAngle],
			max = joint.maxRot[rotationalAngle]

		if ( bio_constraints || min == max ) {
			if ( val < min - epsilon && value < 0 ) {
				return
			}

			if ( val > max + epsilon && value > 0 ) {
				return
			}

			if ( min == max ) {
				return
			}
		}

		joint[rotationalAngle] = val
	}

	joint.updateMatrix()
} // RelativeTurn

function kinematic2D( joint, rotationalAngle, angle, ignoreIfPositive ) {
	// Returns >0 if this turn gets closer

	// Swap Z<->X for wrist
	if ( joint instanceof Wrist ) {
		if ( rotationalAngle == 'x' ) {
			rotationalAngle = 'z'
		} else if ( rotationalAngle == 'z' ) {
			rotationalAngle = 'x'
		}
	}

	let screenPoint = new THREE.Vector3().copy( drag_point.position )

	screenPoint = selected_body_part.localToWorld( screenPoint ).project( camera )

	let distOriginal = mouse.distanceTo( screenPoint ),
		oldAngle = joint[rotationalAngle]

	if ( joint instanceof Head ) { // Head and neck
		oldParentAngle = joint.parentJoint[rotationalAngle]
		relativeTurn( joint, rotationalAngle, angle / 2 )
		relativeTurn( joint.parentJoint, rotationalAngle, angle / 2 )
		joint.parentJoint.updateMatrixWorld( true )
	} else {
		relativeTurn( joint, rotationalAngle, angle )
	}

	joint.updateMatrixWorld( true )

	screenPoint.copy( drag_point.position )
	screenPoint = selected_body_part.localToWorld( screenPoint ).project( camera )

	let distProposed = mouse.distanceTo( screenPoint ),
		dist = distOriginal - distProposed

	if ( ignoreIfPositive && dist > 0 ) {
		return dist
	}

	joint[rotationalAngle] = oldAngle

	if ( joint instanceof Head ) { // Head and neck
		joint.parentJoint[rotationalAngle] = oldParentAngle
	}

	joint.updateMatrixWorld( true )

	return dist
}

function inverseKinematics( joint, rotationalAngle, step ) {
	// Try going in postive or negative direction
	let kPos = kinematic2D( joint, rotationalAngle, 0.001 ),
		kNeg = kinematic2D( joint, rotationalAngle, - 0.001 )

	// If any of them improves closeness, then turn in this direction
	if ( kPos > 0 || kNeg > 0 ) {
		if ( kPos < kNeg ) {
			step = - step
		}

		kinematic2D( joint, rotationalAngle, step, true )
	}
}

function animate( time ) {
	let inv_knm = false

	// No selected object
	if ( ! selected_body_part || ! pressed_mouse_btn ) {
		return
	}

	let elemNone = ! rb_z.checked && ! rb_x.checked && ! rb_y.checked && ! cb_move.checked,
		spinA = selected_body_part instanceof Ankle ? Math.PI / 2 : 0

	gauge.rotation.set( 0, 0, - spinA )

	if ( rb_x.checked || elemNone && pressed_mouse_btn & 0x2 ) {
		gauge.rotation.set( 0, Math.PI / 2, 2 * spinA )
	}

	if ( rb_y.checked || elemNone && pressed_mouse_btn & 0x4 ) {
		gauge.rotation.set( Math.PI / 2, 0, - Math.PI / 2 )
	}

	let joint = cb_move.checked ? selected_body_part.parent.body : selected_body_part

	do {
		for ( let step = 5; step > 0.1; step *= 0.75 ) {
			if ( cb_move.checked && selected_body_part.name === '' ) {
				inverseKinematics( joint, '', step ) // Translate
			} else {
				if ( rb_z.checked || elemNone && pressed_mouse_btn & 0x1 ) {
					inverseKinematics( joint, 'z', step )
				}

				if ( rb_x.checked || elemNone && pressed_mouse_btn & 0x2 ) {
					inverseKinematics( joint, 'x', step )
				}

				if ( rb_y.checked || elemNone && pressed_mouse_btn & 0x4 ) {
					inverseKinematics( joint, 'y', step )
				}
			}
		}

		joint = joint.parentJoint
		inv_knm = false

		/*
		 * Do not work:
		 * inv_knm = cb_move.checked && obj.name !== '';
		 */
	}
	while ( joint && ! ( joint instanceof Mannequin ) && ! ( joint instanceof Pelvis ) && ! ( joint instanceof Torso ) && inv_knm )
}

function onMouseMove( event ) {
	if ( selected_body_part ) {
		userInput( event )
	}
}

function userInput( event ) {
	if ( event instanceof MouseEvent ) {
		event.preventDefault()

		mouse_interface = true
		pressed_mouse_btn = event.buttons || 0x1

		mouse.x = event.clientX / window.innerWidth * 2 - 1
		mouse.y = - event.clientY / window.innerHeight * 2 + 1
	}

	if ( window.TouchEvent && event instanceof TouchEvent && event.touches.length == 1 ) {
		pressed_mouse_btn = 0x1

		touch_interface = true
		mouse.x = event.touches[0].clientX / window.innerWidth * 2 - 1
		mouse.y = - event.touches[0].clientY / window.innerHeight * 2 + 1
	}
}

const dict_keys = [
	'position',
	'rotation',
	'torso',
	'head',
	'left_leg',
	'left_knee',
	'left_ankle',
	'right_leg',
	'right_knee',
	'right_ankle',
	'left_arm',
	'left_elbow',
	'left_wrist',
	'left_fingers',
	'right_arm',
	'right_elbow',
	'right_wrist',
	'right_fingers'
]

function postureToDict( posture ) {
	posture_dict = {}
	posture.forEach( ( pos, index ) => {
		posture_dict[dict_keys[index]] = pos
	} )
	return posture_dict
}

function dictToPosture( posture_dict ) {
	posture = []
	dict_keys.map( ( key, index ) => {
		posture[index] = posture_dict[key]
	} )
	return posture
}

function savePosture() {
	let postures = {}
	for (const [model_name, model] of Object.entries(models)) {
		postures[model_name] = postureToDict(model.posture.data)
		const pos = model.body.position
		postures[model_name].position = [ +(pos.x).toFixed(1), +(pos.y).toFixed(1), +(pos.z).toFixed(1) ]
	}

	let pose = {
		'title':             '',
		'aliases':           [],
		'wtf_version':       0.1,
		'mannequin_version': first_model,
		'description':       '',
		'activity':          'acroyoga',
		'keywords':          [],
		'difficulty':        1,
		'author':            '',
		'source':            '',
		'camera':            {
			'pos': [ 0, 0, 0 ],
			'rot': [ 0, 0, 0 ]
		},
		'postures': postures,
		'comment': ''
	}

	let yaml_posture = YAML.stringify( pose, 3, 2 )

	posture_name = window.prompt( 'Chose posture name:', 'my_posture' )
	downloadBlob( yaml_posture, `${posture_name}.wtfp.yml` )
}

function downloadBlob( content, name ) {
	const blobUrl = URL.createObjectURL( new Blob( [ content ], {
		'type': 'text/yaml'
	} ) )

	const link = document.createElement( 'a' )

	link.style = 'display: none'
	link.href = blobUrl
	link.download = name

	document.body.appendChild( link )

	link.dispatchEvent(
		new MouseEvent( 'click', {
			'bubbles':    true,
			'cancelable': true,
			'view':       window
		} )
	)

	document.body.removeChild( link )
}

function loadPosture( file_load ) {
	let reader = new FileReader()
	let file = file_load.target.files[0]

	if ( ! file.name.endsWith( 'wtfp.yml' ) ) {
		alert( 'Wrong file extension.' )

		return
	} else if ( file.type != 'application/x-yaml' ) {
		alert( 'Wrong file type.' )

		return
	} else if ( file.size > 5000 ) {
		alert( 'File too big.' )

		return
	}

	reader.readAsText( file, 'UTF-8' )

	reader.onload = ( readerEvent ) => {
		let pose = YAML.parse( readerEvent.target.result )

		for (const [model_name, model] of Object.entries(models)) {
			const loaded_posture = pose.postures[model_name]

			let mannequin_posture = {
				'version': pose.mannequin_version,
				'data':    dictToPosture(loaded_posture)
			}
			mannequin_posture.data[0] = loaded_posture.position[1]

			let old_posture_data = postureToDict(model.posture.data)

			try {
				model.postureString = JSON.stringify( mannequin_posture )
				model.body.position.x = loaded_posture.position[0]
				model.body.position.y = loaded_posture.position[1]
				model.body.position.z = loaded_posture.position[2]
			} catch ( error ) {
				model.posture.data = old_posture_data

				if ( error instanceof MannequinPostureVersionError ) {
					alert( error.message )
				} else {
					alert( 'The provided posture was either invalid or impossible to understand.' )
				}

				console.error( error )
			}
		}

		renderer.render( scene, camera )
	}
}
