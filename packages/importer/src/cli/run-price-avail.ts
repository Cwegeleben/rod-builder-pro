// <!-- BEGIN RBP GENERATED: importer-price-avail-job-v1 -->
import { runPriceAvailabilityRefresh } from '../jobs/priceAvail'

const supplier = process.env.SUPPLIER_ID || 'batson'
runPriceAvailabilityRefresh(supplier)
  .then(() => {
    console.log('price_avail done')
  })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
// <!-- END RBP GENERATED: importer-price-avail-job-v1 -->
