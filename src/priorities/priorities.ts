export enum Priority {
    Critical = 0,
    High = 1,
    NormalHigh = 2,
    Normal = 3,
    NormalLow = 4,
    Low = 5,
}

export const blankPriorityQueue = () => {
    return {
        [Priority.Critical]: [],
        [Priority.High]: [],
        [Priority.NormalHigh]: [],
        [Priority.Normal]: [],
        [Priority.NormalLow]: [],
        [Priority.Low]: []
    }
}
