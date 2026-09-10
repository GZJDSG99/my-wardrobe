const STORAGE_KEY = "mw_custom_outfits";
const COLLECTION = "outfits";

const SLOT_DEFS = [
  { key: "tops", label: "上装", required: true, categories: ["tops"] },
  { key: "bottoms", label: "下装", required: true, categories: ["pants", "skirts"] },
  { key: "shoes", label: "鞋履", required: false, categories: ["shoes"] },
  { key: "coats", label: "外套", required: false, categories: ["coats"] },
];

function readLocal() {
  try {
    const v = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function writeLocal(list) {
  wx.setStorageSync(STORAGE_KEY, list.slice(0, 40));
}

function toCard(record) {
  const pieces = record.pieces || [];
  return {
    id: record.id,
    title: record.title || "我的搭配",
    subtitle: "我的搭配",
    temp: record.temp || "",
    reason: record.reason || "你亲手组的一套，适合今天直接穿出门。",
    items: pieces.map((p) => p.name),
    pieces: pieces.map((p) => ({
      id: p.id,
      name: p.name,
      image: p.image || "",
      color: p.color || "#F5E8D8",
      real: true,
      slot: p.slot || "",
    })),
    tags: ["自定义", "我的搭配"],
    liked: false,
    likeIcon: "♡",
    wearLabel: "今天穿这套",
    stamped: false,
    image: (pieces.find((p) => p.image) || {}).image || "",
    realCount: pieces.length,
    totalSlots: pieces.length,
    real: true,
    custom: true,
    source: "custom",
  };
}

function listCustomOutfits() {
  const local = readLocal();
  if (!wx.cloud) {
    return Promise.resolve(local.map(toCard));
  }

  return wx.cloud
    .database()
    .collection(COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()
    .then((res) => {
      const rows = (res.data || []).map((r) => ({
        id: r.localId || r._id,
        title: r.title,
        reason: r.reason,
        temp: r.temp,
        pieces: r.pieces || [],
        createdAt: r.createdAt,
      }));
      // 云端优先，补本地未同步
      const cloudIds = {};
      rows.forEach((r) => {
        cloudIds[r.id] = true;
      });
      const merged = rows.concat(local.filter((l) => !cloudIds[l.id]));
      writeLocal(merged.slice(0, 40));
      return merged.map(toCard);
    })
    .catch(() => local.map(toCard));
}

function saveCustomOutfit(payload) {
  const pieces = payload.pieces || [];
  if (pieces.length < 2) {
    return Promise.reject(new Error("至少选择上装和下装"));
  }

  const item = {
    id: `co_${Date.now()}`,
    title: (payload.title || "").trim() || "我的搭配",
    reason: payload.reason || "你亲手组的一套，适合今天直接穿出门。",
    temp: payload.temp || "",
    pieces,
    createdAt: Date.now(),
  };

  const list = readLocal();
  list.unshift(item);
  writeLocal(list);

  if (!wx.cloud) return Promise.resolve(toCard(item));

  return wx.cloud
    .database()
    .collection(COLLECTION)
    .add({
      data: {
        localId: item.id,
        title: item.title,
        reason: item.reason,
        temp: item.temp,
        pieces: item.pieces,
        createdAt: wx.cloud.database().serverDate(),
      },
    })
    .then(() => toCard(item))
    .catch(() => toCard(item));
}

function deleteCustomOutfit(id) {
  const list = readLocal().filter((x) => x.id !== id);
  writeLocal(list);

  if (!wx.cloud) return Promise.resolve();

  return wx.cloud
    .database()
    .collection(COLLECTION)
    .where({ localId: id })
    .get()
    .then((res) => {
      const tasks = (res.data || []).map((row) =>
        wx.cloud.database().collection(COLLECTION).doc(row._id).remove()
      );
      return Promise.all(tasks);
    })
    .catch(() => null);
}

module.exports = {
  SLOT_DEFS,
  listCustomOutfits,
  saveCustomOutfit,
  deleteCustomOutfit,
  toCard,
};
