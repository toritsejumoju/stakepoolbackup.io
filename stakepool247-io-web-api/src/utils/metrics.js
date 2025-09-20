

export const rowsToMetricsMap = (rows) => {
    const map = {}
    rows.forEach(entry => {
        const {device_id, metric_name, ...data} = entry
        if (map[device_id] === undefined) {
            map[device_id] = {}
        }
        if (map[device_id][metric_name] === undefined) {
            map[device_id][metric_name] = []
        }
        map[device_id][metric_name].push({data})
    });
    return map
}