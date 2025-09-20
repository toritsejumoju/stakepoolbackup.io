import { BlockFrostAPI } from "@blockfrost/blockfrost-js";


export const bfAPI = new BlockFrostAPI({
    projectId: process.env.BF_API_KEY, // see: https://blockfrost.io
    // For a list of all options see section below
});
