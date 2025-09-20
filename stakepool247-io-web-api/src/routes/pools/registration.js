import { Router } from "express";
import { body, validationResult } from "express-validator";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import {
  createPool,
  loadAccessiblePools,
  loadAllPools,
  loadOwnedPools,
  loadReadAccessPools,
  validateConvertPoolIdToBech32,
} from "../../utils/pool.js";
import { loadPoolEpochs } from "../../utils/epoch.js";
import { bfAPI } from "../../config/blockfrost.js";
import axios from "axios";
import { generateValidationToken } from "../../utils/secureToken.js";

const router = Router();

router.get("/lookup/:poolId", requireAuth, async (req, res) => {
  const poolIdBech32 = validateConvertPoolIdToBech32(req.params.poolId);
  if (poolIdBech32 === null) {
    return res.status(400).json({ message: "Invalid Pool ID" });
  }

  const existingPool = await getFirestore('stakepool247-v2')
    .collection("poolData")
    .doc(poolIdBech32)
    .get();

  if (existingPool.exists) {
    if (existingPool.data().owner === req.uid) {
      return res
        .status(400)
        .json({ message: "You have already registered the pool." });
    } else {
      return res.status(403).json({
        message:
          "Pool already registered by other user. Please contact pool owner to get access.",
      });
    }
  }

  const existingRegistrationRequest = await getFirestore('stakepool247-v2')
    .collection("poolRegistration")
    .where("uid", "==", req.uid)
    .where("poolId", "==", poolIdBech32)
    .get();

  let requestDocumentData;

  if (existingRegistrationRequest.empty) {
    const bfPoolMetadata = await bfAPI.poolMetadata(poolIdBech32);

    const metadataUrl = bfPoolMetadata.url;
    const metadata = await axios(metadataUrl);

    const extendedMetadataUrl = metadata.data.extended;

    // Make request to validate URL
    let extendedMetadata;
    try {
      extendedMetadata = await axios(
        `${extendedMetadataUrl}?${Math.floor(Math.random() * 100000)}`
      );
    } catch (e) {
      extendedMetadata = await axios(extendedMetadataUrl);
    }

    const requestDocument = await getFirestore('stakepool247-v2')
      .collection("poolRegistration")
      .add({
        uid: req.uid,
        poolId: bfPoolMetadata.pool_id,
        extendedMetadataUrl: extendedMetadataUrl,
        validationToken: await generateValidationToken(),
      });
    requestDocumentData = (await requestDocument.get()).data();
  } else {
    requestDocumentData = existingRegistrationRequest.docs[0].data();
  }

  if (!requestDocumentData.extendedMetadataUrl) {
    return res
      .status(400)
      .json({ message: "Pool doesn't have extended metadata" });
  }

  const extendedMetadata = await axios(requestDocumentData.extendedMetadataUrl);

  res.json({ ...requestDocumentData, metadataContent: extendedMetadata.data });
});

router.get("/validate/:poolId", requireAuth, async (req, res) => {
  const poolIdBech32 = validateConvertPoolIdToBech32(req.params.poolId);
  if (poolIdBech32 === null) {
    return res.status(400).json({ message: "Invalid Pool ID" });
  }

  const existingPool = await getFirestore('stakepool247-v2')
    .collection("poolData")
    .doc(poolIdBech32)
    .get();

  if (existingPool.exists) {
    if (existingPool.data().owner === req.uid) {
      return res
        .status(400)
        .json({ message: "You have already validated the pool." });
    } else {
      return res.status(403).json({
        message:
          "Pool already registered by other user. Please contact pool owner to get access.",
      });
    }
  }

  const existingRegistrationRequest = await getFirestore('stakepool247-v2')
    .collection("poolRegistration")
    .where("uid", "==", req.uid)
    .where("poolId", "==", poolIdBech32)
    .get();

  let requestDocumentData;

  if (existingRegistrationRequest.empty) {
    return res.status(404).json({
      message:
        "Registration request not found. Please use Lookup button above.",
    });
  } else {
    requestDocumentData = existingRegistrationRequest.docs[0].data();
  }

  let extendedMetadata;
  try {
    extendedMetadata = await axios(
      `${requestDocumentData.extendedMetadataUrl}?${Math.floor(
        Math.random() * 100000
      )}`
    );
  } catch (e) {
    extendedMetadata = await axios(requestDocumentData.extendedMetadataUrl);
  }

  if (
    extendedMetadata.data?.["stakepool247-authentication"] ===
    requestDocumentData.validationToken
  ) {
    return createPool(poolIdBech32, req.uid, res);
  }

  res.status(403).json({ message: "Authentication code not added" });
});

export default router;
