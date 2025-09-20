import moment from 'moment'

const tableMap = [
    {
        table: 'metrics',
        bucketSize: 1,
        bucketSizeText: '1 second',
        availableFor: Infinity,// 60*60*24*30*2, // 2 months
        aggregated: false
    },
    // {
    //     table: 'metrics_hourly',
    //     bucketSize: 60*60,
    //     bucketSizeText: '1 hour',
    //     availableFor: 60*60*24*30*6, // 6 months
    //     aggregated: true
    // },
    // {
    //     table: 'metrics_daily',
    //     bucketSize: 60*60*24,
    //     bucketSizeText: '24 hours',
    //     availableFor: 60*60*24*30*24, // 2 years
    //     aggregated: true
    // },
    // {
    //     table: 'metrics_weekly',
    //     bucketSize: 60*60*24*7,
    //     bucketSizeText: '7 days',
    //     availableFor: Infinity,
    //     aggregated: true
    // },
]

const bucketSizes = [
    {
        time: 1,
        name: '1 second'
    },
    {
        time: 5,
        name: '5 seconds'
    },
    {
        time: 30,
        name: '30 seconds'
    },
    {
        time: 60,
        name: '1 minute'
    },
    {
        time: 60*5,
        name: '5 minutes'
    },
    {
        time: 60*30,
        name: '30 minutes'
    },
    {
        time: 60*60,
        name: '1 hour'
    },
    {
        time: 60*60*3,
        name: '3 hours'
    },
    {
        time: 60*60*12,
        name: '12 hours'
    },
    {
        time: 60*60*24,
        name: '24 hours'
    },
    {
        time: 60*60*24*2,
        name: '2 days'
    },
    {
        time: 60*60*24*7,
        name: '7 days'
    },
    {
        time: 60*60*24*14,
        name: '14 days'
    },
    {
        time: 60*60*24*30,
        name: '1 month'
    },
]

export const parseBucketSize = (startTime, endTime, maxPoints) => {
    const startDateTime = moment(startTime)
    const endDateTime = moment(endTime)

    const timeDiff = endDateTime.diff(startDateTime, 'seconds', true)
    const startOffset = moment().diff(startDateTime, 'seconds', true)
    
    // Filter out raw data if start time too old
    let availableTables = tableMap.filter(table => table.availableFor > startOffset)

    // Filter out tables, whose bucket size is larger than requested period
    availableTables = availableTables.filter(table => table.bucketSize < timeDiff)

    // Order by bucket size
    availableTables = availableTables.sort((a, b) => a.bucketSize - b.bucketSize)

    if (availableTables.length === 0) {
        console.error("Fitting table not found")
        return {table: null, bucketSize: null}
    }

    const chosenTable = availableTables[0]

    const availableBuckets = bucketSizes
        .filter(bucket => bucket.time > chosenTable.bucketSize)
        .filter(bucket => bucket.time > timeDiff / maxPoints)
        .sort((a, b) => a.time - b.time)

    if (availableBuckets.length === 0) {
        console.error("Fitting bucket not found")
        return {table: null, bucketSize: null}
    }

    return {
        table: chosenTable,
        bucketSize: availableBuckets[0]
    }
}
