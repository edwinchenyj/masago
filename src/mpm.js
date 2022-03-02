import * as THREE from 'three'
// import * as math from 'mathjs'
const {matrix, zeros, floor, add, subtract, multiply, square, divide, trace,transpose} = require('mathjs')

const eos_stiffness = 10.0
const eos_power = 4
const rest_density = 4.0
const dynamic_viscosity = 0.1

const gravity = [0, -0.05] 
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
        p.velocity = multiply(0.5,matrix([ Math.random() - 0.5, Math.random() - 0.5  + 1]) ) 
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
  P2G_second(grid, particles, grid.grid_res, dt, dimension)
  gridVelocityUpdate(grid, grid.grid_res, dt, dimension)
  G2P(grid, particles, grid.grid_res, dt, dimension) // includes dt for advection
}

export function resetGrid(grid = [], dimension =2) {
  // reset grid
  if(dimension == 2){
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i].velocity = [0,0]
    grid.cells[i].mass = 0
  }  
  }
  if(dimension == 3){
    for(let i = 0; i < grid.cells.length; i++){
      grid.cells[i].velocity = [0,0,0]
      grid.cells[i].mass = 0
    }
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
          const weight = weights[gx][0] * weights[gy][1]

          const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
          const cell_dist = add(0.5, subtract(cell_idx_local, position))
          const Q = multiply((p.C), cell_dist)

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

function P2G_second(grid, particles = [], grid_res, dt=1, dimension = 2) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]

    const position = p.position.toArray().slice(0, dimension)
    const cell_idx = floor(position)

    const cell_diff = subtract(subtract(position,cell_idx), 0.5)
    const weights = []
    calculateQuadraticWeights(cell_diff, weights)

    let density = 0
    if(dimension == 2){
      for(let gx = 0; gx < weights.length; gx++){
        for(let gy = 0; gy < weights.length; gy++){
          const weight = weights[gx][0] * weights[gy][1]

          const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
          const cell_index = cell_idx_local[0]*grid_res + cell_idx_local[1]
          density += grid.cells[cell_index].mass * weight
        }
      }
      const volume = p.mass/density

      const pressure = Math.max(-0.1, eos_stiffness * (Math.pow(density / rest_density, eos_power ) - 1))
      let stress = matrix([[-pressure, 0], [0, -pressure]])
      const dudv = p.C
      const strain = dudv
      // const strain_trace = trace(strain)
      const strain_trace = strain.get([1,0]) + strain.get([0,1])
      strain.set([0,1], strain_trace)
      strain.set([1,0], strain_trace)

      const viscosity_term = multiply(dynamic_viscosity,strain)
      stress = add(stress, viscosity_term)

      const eq_16_term_0 = multiply(-volume*4*dt, stress)

      for(let gx = 0; gx < weights.length; gx++){
        for(let gy = 0; gy < weights.length; gy++){
          const weight = weights[gx][0] * weights[gy][1]
          const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
          const cell_dist = add(subtract(cell_idx_local, position), 0.5)

          const cell_index = cell_idx_local[0]*grid_res + cell_idx_local[1]
          const cell = grid.cells[cell_index]

          const momentum = multiply(multiply(eq_16_term_0, weight),cell_dist)
          cell.velocity = add(cell.velocity, momentum)

          grid.cells[cell_index] = cell
        }
      }
    }

  }
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
          cell.velocity.set([0],0.0)
        }
        if (y < 2 || y > grid_res - 3) {
          cell.velocity.set([1],0.0)
        }
      }
      if (dimension == 3) {
        if(gravity.length == 2){
          gravity.push(0)
        }
        cell.velocity = add(cell.velocity, multiply(dt,gravity))

        // boundary conditions
        const x = parseInt(i / grid_res)
        const y = parseInt(i % grid_res)
        const z = parseInt(i / (grid_res * grid_res))
        if (x < 2 || x > grid_res - 3) {
          cell.velocity.set([0],0.0)
        }
        if (y < 2 || y > grid_res - 3) {
          cell.velocity.set([1],0.0)
        }
        if (z < 2 || z > grid_res - 3) {
          cell.velocity.set([2],0.0)
        }
      }
      grid.cells[i] = cell
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
    if(dimension == 2){
      for(let gx = 0; gx < weights.length; gx++){
        for(let gy = 0; gy < weights.length; gy++){
          const weight = weights[gx][0] * weights[gy][1]

          const cell_idx_local = [cell_idx[0] + gx - 1, cell_idx[1] + gy - 1]
          const cell_index = parseInt(cell_idx_local[0])*grid_res + parseInt(cell_idx_local[1])
          const cell_dist = add(0.5, subtract(cell_idx_local, position))

          const weighted_velocity = multiply(grid.cells[cell_index].velocity, weight)

          const term = (matrix([multiply(weighted_velocity, cell_dist[0]), multiply(weighted_velocity, cell_dist[1])]))

          B = add(B, term)

          p.velocity = add(p.velocity, weighted_velocity)
        }
      }
    }
    p.C = multiply(B,4.0)
    advect(p, dt, dimension)
    safetyClamp(p, grid_res, dimension)
    // handleBC(p, grid_res, dt, dimension)

    particles[i] = p
  }

}

function advect(p, dt=1, dimension = 2) {
  const movement = multiply(p.velocity, dt)
  p.position.x = p.position.x + movement.toArray()[0]
  p.position.y = p.position.y + movement.toArray()[1]
}

function safetyClamp(p, grid_res, dimension = 2) {
  p.position.clampScalar(1, grid_res - 2)
}

function handleBC(p, grid_res, dt = 1, dimension = 2){
  const approx = add(p.position.toArray().slice(0, dimension), multiply(dt,p.velocity).toArray().slice(0, dimension))
  const wall_min = 3
  const wall_max = grid_res - 4
  if(approx[0] < wall_min){
    p.velocity.set([0],add(p.velocity.get([0]), wall_min - approx[0])) 
  }
  if(approx[0] > wall_max){
    p.velocity.set([0],add(p.velocity.get([0]), wall_max - approx[0]))
  }
  if(approx[1] < wall_min){
    p.velocity.set([1],add(p.velocity.get([1]), wall_min - approx[1]))
  }
  if(approx[1] > wall_max){
    p.velocity.set([1],add(p.velocity.get([1]), wall_max - approx[1]))
  }
}