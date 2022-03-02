import * as THREE from 'three'

import { WEBGL } from './webgl'
import './modal'
import { OrbitControls } from '@three-ts/orbit-controls'
import * as MPM from './mpm'
import GUI from 'lil-gui'

const gui = new GUI()

const gui_state = {
  dimension: 2,
  amount_per_side: 1,
  grid_res: 1,
  gravity: [0, -0.05],
  dt: 0.01,
  iterations: 1,
  show_velocity: false,
  show_grid: false,
  show_particles: true,
  show_forces: false,
  show_grid_forces: false,
  show_grid_velocity: false,
  show_grid_pressure: false,
} 

gui.add(gui_state, 'dimension', [2, 3])


if (WEBGL.isWebGLAvailable()) {
  var camera, scene, renderer, controls
  var plane
  var mouse,
    raycaster,
    isShiftDown = false


  var objects = []

  const particles_per_side = parseInt( window.location.search.slice( 1 ) ) || 16 
  const dimension = 2
  const color = new THREE.Color()

  const particles = {
    mesh: null,
    list: [],
  } 
  const grid = {
    grid_res: particles_per_side * 4,
    cells: [],
  } 

  const dt = 1.0;

  init()
  animate()

  function init() {
    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      10000
    )
    camera.position.set(2*particles_per_side, particles_per_side , 80)
    camera.lookAt(2*particles_per_side, particles_per_side , 0)


    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x666666)


    var gridHelper = new THREE.GridHelper(particles_per_side * 4, particles_per_side)
      gridHelper.translateX(2*particles_per_side )
    scene.add(gridHelper)

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    var plane_geometry = new THREE.PlaneBufferGeometry(100, 100)
    plane_geometry.rotateX(-Math.PI / 2)

    plane = new THREE.Mesh(
      plane_geometry,
      new THREE.MeshBasicMaterial({ visible: false })
    )
    scene.add(plane)

    objects.push(plane)


    var directionalLight = new THREE.DirectionalLight(0xffffff)
    directionalLight.position.set(5,5,5).normalize()
    scene.add(directionalLight)

    // instancing mesh
    MPM.initializeParticle(particles_per_side, particles, dimension, grid.grid_res)
    MPM.initializeGrid(grid, dimension)
    scene.add( particles.mesh )


    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    // controls = new OrbitControls(camera, renderer.domElement)

    window.addEventListener('resize', onWindowResize)
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  function animate(){
    requestAnimationFrame(animate)
    MPM.simulate(grid, particles.list, dt)
    // controls.update()
    render()
  }

  function render() {
    const mat4 = new THREE.Matrix4()

    for(let i = 0; i < particles.list.length; i++) {
      // particles.mesh.setcolorat(i, color.sethex(math.random() * 0xffffff))
      // particles.mesh.instancecolor.needsupdate = true
      mat4.setPosition(particles.list[i].position)
      particles.mesh.setMatrixAt(i, mat4)
      particles.mesh.instanceMatrix.needsUpdate = true
    }


    renderer.render(scene, camera)
  }
} else {
  var warning = WEBGL.getWebGLErrorMessage()
  document.body.appendChild(warning)
}
