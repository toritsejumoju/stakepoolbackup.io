export const metricFields = [
    // System resources
    {
        value: 'hdd_free',
        label: 'HDD free (%)',
        unit: '%'
    },
    {
        value: 'hdd_free_percent',
        label: 'HDD free (%)',
        unit: '%'
    },
    {
        value: 'mem_total',
        label: 'Total RAM (MB)',
        unit: 'MB'
    },
    {
        value: 'mem_free',
        label: 'Free RAM (MB)',
        unit: 'MB'
    },
    {
        value: 'mem_avail',
        label: 'Available RAM (MB)',
        unit: 'MB'
    },
    {
        value: 'mem_free_percent',
        label: 'Free RAM (%)',
        unit: '%'
    },
    {
        value: 'cpu_load',
        label: 'CPU load (%)',
        unit: '%'
    },
    {
        value: 'cpu_count',
        label: 'CPU count',
        unit: ''
    },

    // Cardano Node
    {
        value: 'kes_count',
        label: 'KES count',
        unit: ''
    },
    {
        value: 'synced',
        label: 'Is synced',
        unit: ''
    },
    {
        value: 'conn_in',
        label: 'Incomming connection count',
        unit: ''
    },
    {
        value: 'conn_out',
        label: 'Outgoing connection count',
        unit: ''
    },
    {
        value: 'leadership_check_skip',
        label: 'Leadership check skip',
        unit: ''
    },
]

export const allowedMetrics = metricFields.map(m => m.value)
