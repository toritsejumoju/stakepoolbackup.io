import { getFirestore } from "firebase-admin/firestore";
import { bech32 } from "bech32";
import * as jose from 'jose'
import { JWT_KEY } from "../config/jwt.js";
import { bfAPI } from "../config/blockfrost.js";

export const loadReadAccessPools = async (uid) => {
  return await getFirestore('stakepool247-v2')
    .collection("poolData")
    .where("allowRead", "array-contains", uid)
    .get()
    .then((pools) => {
      return pools.docs.map((pool) => ({ ...pool.data(), id: pool.id }));
    });
};

export const loadOwnedPools = async (uid) => {
  return await getFirestore('stakepool247-v2')
    .collection("poolData")
    .where("owner", "==", uid)
    .get()
    .then((pools) => {
      // Filter out documents where poolDisabled is true
      return pools.docs.filter(pool => pool.data().poolDisabled !== true)
                        .map((pool) => ({ ...pool.data(), id: pool.id }));
    });
};

export const loadAccessiblePools = async (uid) => {
  const readAccessPoolsPromise = loadReadAccessPools(uid);
  const ownedPoolsPromise = loadOwnedPools(uid);
  const [ownedPools, readAccessPools] = await Promise.all([
    ownedPoolsPromise,
    readAccessPoolsPromise,
  ]);

  readAccessPools.forEach((pool) => {
    const currentId = pool.id;
    if (ownedPools.findIndex((existing) => existing.id === currentId) === -1) {
      ownedPools.push(pool);
    }
  });

  return ownedPools;
};

export const loadAllPools = async () => {
  return await getFirestore('stakepool247-v2')
    .collection("poolData")
    .get()
    .then((pools) => {
      // Filter out documents where poolDisabled is true
      return pools.docs.filter(pool => pool.data().poolDisabled !== true)
                        .map((pool) => ({ ...pool.data(), id: pool.id }));
    });
};


export const validatePoolOwner = async (poolId, userId, res) => {
  const poolReq = await getFirestore('stakepool247-v2').collection("poolData").doc(poolId).get();

  if (!poolReq.exists) {
    res.status(404).json({ message: "Pool not found" });
    return false;
  }

  const poolData = poolReq.data();
  if (poolData.owner !== userId) {
    res.status(403).json({ message: "Pool not owned by user" });
    return false;
  }

  return poolData;
};

export const createPool = async (poolId, uid, res) => {
  try {
    const hash = bech32.decode(poolId);

    const poolRef = getFirestore('stakepool247-v2').collection("poolData").doc(poolId);

    const poolIdHex = Buffer.from(bech32.fromWords(hash.words)).toString("hex");
    const bfPoolInfo = await bfAPI.poolsById(poolId);
    const stakeAddress = bfPoolInfo.reward_account;

    if (bfPoolInfo.retirement.length > 0) {
      return res
        .status(403)
        .json({ message: "Retired pool registration not allowed" });
    }

    const bfPoolMetadata = await bfAPI.poolMetadata(poolId);
    const ticker = bfPoolMetadata.ticker;

    const jwt = await new jose.SignJWT({ device: 'Block Producer', pool: poolId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .sign(JWT_KEY)

    const newPoolResult = await poolRef.create({
      allowRead: [],
      owner: uid,
      poolId: poolIdHex,
      poolIdBech32: poolId,
      poolStakeAddress: stakeAddress,
      status: {
        poolIdBech32: true,
        poolStakeAddress: true,
        ticker: !!ticker,
      },
      devices: [{
        name: 'Block Producer',
        deviceType: 'block',
        token: jwt
      }],
      ticker: ticker,
    });
    return res.json(newPoolResult);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message });
  }
};

export const validateConvertPoolIdToBech32 = (poolId) => {
  try {
    // Try decoding, if success, return it
    const hash = bech32.decode(poolId);
    if (hash.prefix === "pool") {
      return poolId;
    }
    return null;
  } catch (e) {
    try {
      if (poolId.length !== 56) {
        return null;
      }
      const poolAddress = bech32.encode(
        "pool",
        bech32.toWords(Uint8Array.from(Buffer.from(poolId, "hex"))),
        1000
      );
      return poolAddress;
    } catch (e2) {
      return null;
    }
  }
};
