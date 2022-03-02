import * as THREE from 'three'

import { WEBGL } from './webgl'
import './modal'
import { OrbitControls } from '@three-ts/orbit-controls'
import * as MPM from './mpm'
import GUI from 'lil-gui'

const gui = new GUI()

const state = {
  scene: null,
  refresh:  () => {
    console.log('refresh')
    state.scene.remove(state.particles.mesh)
    state.particles.list = []
    state.grid_res = state.amount_per_side * 4
    state.grid.cells = []
    state.initMPM()
    },
  initMPM: () =>{
    MPM.initializeParticle(state.amount_per_side, state.particles, state.dimension, state.grid.grid_res)
    MPM.initializeGrid(state.grid, state.dimension)
    state.scene.add( state.particles.mesh )
  },
  dimension: 2,
  amount_per_side: 16,
  grid_res: 1,
  gravity: [0, -0.05],
  dt: 0.1,
  
  iterations: 1,
  particles: {
    mesh: null,
    list: [],
  },
  grid: {
    grid_res: 64,
    cells:[],
  },
  show_velocity: false,
  show_grid: false,
  show_particles: true,
  show_forces: false,
  show_grid_forces: false,
  show_grid_velocity: false,
  show_grid_pressure: false,
} 

gui.add(state, 'refresh')
// gui.add(state, 'dimension', {'2D': 2, '3D': 3}).onChange(state.refresh)

if (WEBGL.isWebGLAvailable()) {
  var camera, scene, renderer, controls
  var plane
  var mouse,
    raycaster,
    isShiftDown = false


  var objects = []

  const particles_per_side = parseInt( window.location.search.slice( 1 ) ) || 16 

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


    state.scene = new THREE.Scene()
    state.scene.background = new THREE.Color(0x666666)


    var gridHelper = new THREE.GridHelper(particles_per_side * 4, particles_per_side)
      gridHelper.translateX(2*particles_per_side )
      gridHelper.translateZ(-particles_per_side )
    state.scene.add(gridHelper)

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    var plane_geometry = new THREE.PlaneBufferGeometry(100, 100)
    plane_geometry.rotateX(-Math.PI / 2)

    plane = new THREE.Mesh(
      plane_geometry,
      new THREE.MeshBasicMaterial({ visible: false })
    )
    state.scene.add(plane)

    objects.push(plane)


    var directionalLight = new THREE.DirectionalLight(0xffffff)
    directionalLight.position.set(5,5,5).normalize()
    state.scene.add(directionalLight)

    // instancing mesh
    state.initMPM()



    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    // controls = new OrbitControls(camera, renderer.domElement)

    window.addEventListener('resize', onWindowResize)
  }
  
  function initMPM(dimension = 2) {
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  function animate(){
    setTimeout(function() {
      requestAnimationFrame(animate)
      MPM.simulate(state.grid, state.particles.list, state.dt, state.dimension)
}, 1.0/state.dt)
    // controls.update()
    render()
  }

  function render() {
    const mat4 = new THREE.Matrix4()

    for(let i = 0; i < state.particles.list.length; i++) {
      // particles.mesh.setcolorat(i, color.sethex(math.random() * 0xffffff))
      // particles.mesh.instancecolor.needsupdate = true
      mat4.setPosition(state.particles.list[i].position)
      state.particles.mesh.setMatrixAt(i, mat4)
      state.particles.mesh.instanceMatrix.needsUpdate = true
    }


    renderer.render(state.scene, camera)
  }



} else {
  var warning = WEBGL.getWebGLErrorMessage()
  document.body.appendChild(warning)
}
