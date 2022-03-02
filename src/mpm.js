import * as THREE from 'three'
// import * as math from 'mathjs'
const {matrix, zeros, floor, add, subtract, multiply, square, divide} = require('mathjs')

export function Particle(dimension = 2) {
  return {
    position: new THREE.Vector3(0,0,0),
    velocity: matrix(zeros(dimension)), 
    color: new THREE.Color(0xffffff),
    C: matrix(zeros(dimension, dimension)),
    mass: 1.0,
    padding: 0.0,
  }
}

const gravity = [0, -0.05] 
export function Cell(dimension = 2) {
  return {
    velocity: matrix(zeros(dimension)),
    mass: 0.0,
    padding: 0.0,
  }
}

export function initializeParticle(
  amount_per_side = 1,
  particles,
  dimension = 2,
  grid_res = amount_per_side * 4
) {
  particles.list = []
  const particle_geometry = new THREE.IcosahedronGeometry(0.5, 1)
  const particle_material = new THREE.MeshLambertMaterial()
  particles.mesh = new THREE.InstancedMesh(
    particle_geometry,
    particle_material,
    amount_per_side ** dimension
  )

  let i = 0
  const threejs_matrix = new THREE.Matrix4()
  const color = new THREE.Color()

  const spacing = 1.0
  const box_x = amount_per_side * spacing
  const box_y = amount_per_side * spacing
  const box_z = amount_per_side * spacing
  const x_center = grid_res / 2.0
  const y_center = grid_res / 2.0
  const z_center = grid_res / 2.0

  if (dimension == 2) {
    for ( let x_pos = x_center - box_x / 2.0; x_pos < x_center + box_x / 2.0; x_pos += spacing) {
      for ( let y_pos = y_center - box_y / 2.0; y_pos < y_center + box_y / 2.0; y_pos += spacing) {
        threejs_matrix.setPosition(new THREE.Vector3(x_pos, y_pos, 0))
        let p = new Particle(dimension)
        p.position.setFromMatrixPosition(threejs_matrix)
        p.velocity = [0,0]
        p.velocity = multiply(0.001,matrix([ Math.random() - 0.5, Math.random() - 0.5  ]) ) 
        p.C = matrix(zeros(dimension,dimension))
        p.mass = 1.0
        particles.list.push(p)

        particles.mesh.setMatrixAt(i, threejs_matrix)
        particles.mesh.setColorAt(i, color.setHex(0xadd8e6))
        i++
      }
    }
  } 
}

export function initializeGrid(grid, dimension = 2) {
  const num_cells = grid.grid_res ** dimension
  for (let i = 0; i < num_cells; i++) {
    grid.cells.push(new Cell(dimension))
  }
}

export function simulate(grid, particles, dt=1, dimension = 2) {
  resetGrid(grid, dimension)
  P2G(grid, particles, grid.grid_res, dimension)
  gridVelocityUpdate(grid, grid.grid_res, dt, dimension)
  G2P(grid, particles, grid.grid_res, dt, dimension) // includes dt for advection
  setTimeout(function(){}, 100)
}

export function resetGrid(grid = [], dimension =2) {
  // reset grid
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i].velocity = matrix(zeros(dimension))
    grid.cells[i].mass = 0.0
  }
}

export function P2G(grid, particles = [], grid_res, dimension = 2) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const position = p.position.toArray().slice(0, dimension)
    const cell_idx = floor(position)

    const cell_diff = subtract(subtract(position,cell_idx), 0.5)
    const weights = []
    calculateQuadraticWeights(cell_diff, weights)

    if(dimension == 2){
      for(let gx = 0; gx < weights.length; gx++){
        for(let gy = 0; gy < weights.length; gy++){
          const weight = weights[gx][0] + weights[gy][1]

          const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
          const cell_dist = add(0.5, subtract(cell_idx_local, position))
          const Q = multiply(p.C, cell_dist)

          const mass_contrib = weight * p.mass

          const cell_index = cell_idx_local[0]*grid_res + cell_idx_local[1]
          const cell = grid.cells[cell_index]

          cell.mass += mass_contrib
          cell.velocity = add(cell.velocity, multiply(mass_contrib, add(p.velocity, Q)))
          grid.cells[cell_index] = cell
        }

    }
    }
  }
}

function gridIndex(x, y, z, grid_res) {
  return x + y * grid_res + z * grid_res * grid_res
}

function calculateQuadraticWeights(cell_diff, weights) {
  
  weights.push(multiply(square(subtract(0.5, cell_diff)),0.5))
  weights.push(subtract(0.75, square(cell_diff)))
  weights.push(multiply(square(add(0.5, cell_diff)),0.5))
}

export function gridVelocityUpdate(grid = [], grid_res, dt=1, dimension = 2) {
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i]
    if (cell.mass > 0.0) {
      cell.velocity = divide(cell.velocity, cell.mass)
      if (dimension == 2) {
        cell.velocity = add(cell.velocity, multiply(dt,gravity))

        // boundary conditions
        const x = parseInt(i / grid_res)
        const y = parseInt(i % grid_res)
        if (x < 2 || x > grid_res - 3) {
          cell.velocity[0] = 0.0
        }
        if (y < 2 || y > grid_res - 3) {
          cell.velocity[1] = 0.0
        }
        grid.cells[i] = cell
      }
    }
    grid.cells[i] = cell
  }
}

export function G2P(grid = [], particles = [], grid_res, dt=1, dimension = 2) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.velocity = zeros(dimension)

    const position = p.position.toArray().slice(0, dimension)
    const cell_idx = floor(position)

    const cell_diff = subtract(subtract(position,cell_idx), 0.5)
    const weights = []
    calculateQuadraticWeights(cell_diff, weights)

    let B = matrix(zeros(dimension, dimension))
    for(let gx = 0; gx < weights.length; gx++){
      for(let gy = 0; gy < weights.length; gy++){
        const weight = weights[gx][0] + weights[gy][1]

        const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
        const cell_index = parseInt(cell_idx_local[0])*grid_res + parseInt(cell_idx_local[1])
        const cell_dist = add(0.5, subtract(cell_idx_local, position))

        const weighted_velocity = multiply(grid.cells[cell_index].velocity, weight)
        // if(weighted_velocity.toArray()[0] > 1){
        //   console.log(weighted_velocity)
        // }
        // if(weighted_velocity.toArray()[0] < -1){
        //   console.log(weighted_velocity)
        // }
        // if(weighted_velocity.toArray()[1] > 1){
        //   console.log(weighted_velocity)
        // }
        // if(weighted_velocity.toArray()[1] < -1){
        //   console.log(weighted_velocity)
        // }

        p.velocity = add(p.velocity, weighted_velocity)
        
        // if(p.velocity.toArray()[0] > 1.0 || p.velocity.toArray()[0] < -1.0){
        //   console.log(p.velocity)
        // }
        // if(p.velocity.toArray()[1] > 1.0 || p.velocity.toArray()[1] < -1.0){
        //   console.log(p.velocity)
        // }
      }
    }

    // p.C = multiply(B,4.0)
    advect(p, dt)
    safetyClamp(p, grid_res)

    particles[i] = p
  }
}

function advect(p, dt=1) {
  const movement = multiply(p.velocity, dt)
  // console.log(movement)
  // if(movement.toArray()[0] > 1.0 || movement.toArray()[0] < -1.0){
  //   console.log(movement)
  // }
  // if(movement.toArray()[1] > 1.0 || movement.toArray()[1] < -1.0){
  //   console.log(movement)
  // }
  p.position.x = p.position.x + movement.toArray()[0]
  p.position.y = p.position.y + movement.toArray()[1]
  // p.position = add(p.position, multiply(dt, p.velocity))
}

function safetyClamp(p, grid_res) {
    if(p.position.x < 1.0){
      p.position.x = 1.0
    }
    if(p.position.x > grid_res - 2.0){
      p.position.x = grid_res - 2.0
    }
    if(p.position.y < 1.0){
      p.position.y = 1.0
    }
    if(p.position.y > grid_res - 2.0){
      p.position.y = grid_res - 2.0
    }

}
