import * as THREE from 'three'
export function Particle() {
  return {
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(0, 0, 0),
    color: new THREE.Color(0xffffff),
    C: new THREE.Matrix3(),
    mass: 1.0,
    padding: 0.0,
  }
}

const halfVector = new THREE.Vector3(0.5, 0.5, 0.5)
const gravity = new THREE.Vector3(0, -9.8, 0)
export function Cell() {
  return {
    velocity: new THREE.Vector3(0,0,0),
    mass: 0.0,
    padding: 0.0,
  }
}

export function initializeParticle(amount_per_side = 1, particles, dimension = 3) {
  const particle_geometry = new THREE.IcosahedronGeometry(0.5, 1)
  const particle_material = new THREE.MeshLambertMaterial()
  particles.mesh = new THREE.InstancedMesh(
    particle_geometry,
    particle_material,
    amount_per_side ** dimension
  )

  let i = 0
  const offset = (amount_per_side - 1)
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
        
  for (let ix = 0; ix < amount_per_side; ix++) {
    for (let iy = 0; iy < amount_per_side; iy++) {
      for (let iz = 0; iz < amount_per_side; iz++) {
        matrix.setPosition(offset - ix, 6 * offset - iy, offset - iz)
        let p = new Particle()
        p.position.setFromMatrixPosition(matrix)
        particles.list.push(p)

        particles.mesh.setMatrixAt(i, matrix)
        particles.mesh.setColorAt(i, color.setHex(0xadd8e6))
        i++
      }
    }
  }
}

export function initializeGrid(grid, dimension) {
  const num_cells = grid.grid_res ** dimension
  for (let i = 0; i < num_cells; i++) {
    grid.cells.push(new Cell())
  }
}

export function simulate(grid, particles, grid_res, dt) {
  resetGrid(grid)
  P2G(grid, particles, grid_res)
  gridVelocityUpdate(grid, grid_res, dt)
  G2P(grid, particles, grid_res, dt) // includes dt for advection
}

export function resetGrid(grid = []) {
  // reset grid
  for (let i = 0; i < grid.length ; i++) {
    grid[i].velocity = new THREE.Vector3(0,0,0)
    grid[i].mass = 0.0
  }
}

export function P2G(grid, particles = [], grid_res) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const cell_idx = p.position.clone().floor()
    const cell_diff = p.position
      .clone()
      .sub(cell_idx)
      .sub(new THREE.Vector3(0.5, 0.5, 0.5))
    const weights = []
    calculateQuadraticWeights(cell_diff, weights)

    for (let x_index = 0; x_index < 3; x_index++) {
        for (let y_index = 0; y_index < 3; y_index++) {
            for (let z_index = 0; z_index < 3; z_index++) {
                const cell_idx_local = new THREE.Vector3(cell_idx.x + x_index -1 , cell_idx.y + y_index - 1, cell_idx.z + z_index -1)
                const cell_dist = cell_idx_local.clone().sub(p.position).addScalar(0.5)
                const Q = cell_dist.applyMatrix3(p.C) 
                const index = gridIndex(
                    cell_idx.x + x_index,
                    cell_idx.y + y_index,
                    cell_idx.z + z_index, grid_res
                )
                const weight = weights[x_index].x * weights[y_index].y * weights[z_index].z
                const particle_mass = p.mass * weight
                if(grid[index] === undefined) {
                    console.log(index)
                }
                
                grid[index].velocity.add(p.velocity.clone().multiplyScalar(particle_mass))
                grid[index].mass += particle_mass
            }
        }
        
    }
  }
}

function gridIndex(x, y, z, grid_res) {
  return x + y * grid_res + z * grid_res * grid_res
}

function calculateQuadraticWeights(cell_diff, weights) {
  const weight0_vector = halfVector.clone().sub(cell_diff)
  weights.push(weight0_vector.multiply(weight0_vector).multiplyScalar(0.5))
  weights.push(halfVector
    .clone()
    .multiplyScalar(3.0 / 2.0)
    .sub(cell_diff.clone().multiply(cell_diff)))

  const weight2_vector = halfVector.clone().add(cell_diff)
  weights.push(weight2_vector.multiply(weight2_vector))
}

export function gridVelocityUpdate(grid = [], grid_res, dt) {
    for (let i = 0; i < grid.length; i++) {
        const cell = grid[i]
        if (cell.mass > 0.0) {
            cell.velocity.divideScalar(cell.mass)
            cell.velocity.add(gravity.clone().multiplyScalar(dt))
        
            // boundary conditions
            const x = i / grid_res
            const y = (i % grid_res) / grid_res
            const z = i % (grid_res * grid_res) / grid_res
            if (x == 0 || x > grid_res - 2) {
                cell.velocity.x = 0.0
            }
            if (y == 0 || y > grid_res - 2) {
                cell.velocity.y = 0.0
            }
            if (z == 0 || z > grid_res - 2) {
                cell.velocity.z = 0.0
            }
        }
        grid[i] = cell

    }
}

export function G2P(grid = [], particles = [], grid_res, dt) {
    for (let i = 0; i < particles.length; i++) {
        particles[i].velocity.set(0, 0, 0) // reset

        const cell_idx = particles[i].position.clone().floor()
        const cell_diff = particles[i].position.clone().sub(cell_idx).subScalar(0.5)
        const weights = []
        calculateQuadraticWeights(cell_diff, weights)
        
        const B = new THREE.Matrix3()
        for (let x_index = 0; x_index < 3; x_index++) {
            for (let y_index = 0; y_index < 3; y_index++) {
                for (let z_index = 0; z_index < 3; z_index++) {
                    const cell_idx_local = new THREE.Vector3(cell_idx.x + x_index -1 , cell_idx.y + y_index - 1, cell_idx.z + z_index -1)
                    const cell_dist = cell_idx_local.clone().sub(particles[i].position).addScalar(0.5)
                    const index = gridIndex(
                        cell_idx.x + x_index,
                        cell_idx.y + y_index,
                        cell_idx.z + z_index, grid_res
                    )
                    const weight = weights[x_index].x * weights[y_index].y * weights[z_index].z
                    const weighted_velocity = grid[index].velocity.clone().multiplyScalar(weight)

                    const term = new THREE.Matrix3()
                    term.set(weighted_velocity.x * cell_dist.x, weighted_velocity.y * cell_dist.x, weighted_velocity.z * cell_dist.x,
                                weighted_velocity.x * cell_dist.y, weighted_velocity.y * cell_dist.y, weighted_velocity.z * cell_dist.y,
                                weighted_velocity.x * cell_dist.z, weighted_velocity.y * cell_dist.z, weighted_velocity.z * cell_dist.z)
                    const sum = B.elements.map((e, i) => e + term.elements[i])
                    B.fromArray(sum)

                    particles[i].velocity.add(weighted_velocity)
                }
            }
        }
    particles[i].C = B.clone().multiplyScalar(4)

    advect(particles[i],dt)
    safetyClamp(particles[i], grid_res)

    }



}

function advect(p,dt) {
    p.position.add(p.velocity.clone().multiplyScalar(dt))
}

function safetyClamp(p, grid_res) {
    p.position.clampScalar(0, grid_res - 1)
}
