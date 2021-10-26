import cluster = require('cluster')
import { Cluster } from 'cluster'

const Cluster = cluster as unknown as Cluster

export default Cluster
