/**
 * Open-Meteo 天气（免费、无需 API Key）
 * 文档：https://open-meteo.com/en/docs
 */

const CITY_FALLBACK = {
  Hangzhou: { name: "杭州", latitude: 30.29365, longitude: 120.16142, timezone: "Asia/Shanghai" },
  杭州: { name: "杭州", latitude: 30.29365, longitude: 120.16142, timezone: "Asia/Shanghai" },
  Shanghai: { name: "上海", latitude: 31.22222, longitude: 121.45806, timezone: "Asia/Shanghai" },
  上海: { name: "上海", latitude: 31.22222, longitude: 121.45806, timezone: "Asia/Shanghai" },
};

/** WMO weather interpretation codes → 中文 */
const WMO_ZH = {
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "毛毛雨",
  53: "毛毛雨",
  55: "浓毛毛雨",
  56: "冻毛毛雨",
  57: "冻毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "雪粒",
  80: "小阵雨",
  81: "阵雨",
  82: "强阵雨",
  85: "小阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷阵雨伴冰雹",
  99: "强雷阵雨伴冰雹",
};

const WMO_ICON = {
  0: "☀",
  1: "🌤",
  2: "⛅",
  3: "☁",
  45: "🌫",
  48: "🌫",
  51: "🌦",
  53: "🌦",
  55: "🌧",
  61: "🌧",
  63: "🌧",
  65: "🌧",
  71: "❄",
  73: "❄",
  75: "❄",
  80: "🌦",
  81: "🌧",
  82: "🌧",
  95: "⛈",
  96: "⛈",
  99: "⛈",
};

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
const MONTHS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

function codeZh(code) {
  return WMO_ZH[code] || "未知";
}

function codeIcon(code) {
  return WMO_ICON[code] || "☁";
}

function uvLabel(uv) {
  const n = Number(uv) || 0;
  if (n <= 2) return "低";
  if (n <= 5) return "中";
  if (n <= 7) return "高";
  return "很强";
}

function windDirLabel(degree) {
  const d = ((Number(degree) % 360) + 360) % 360;
  const dirs = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];
  const idx = Math.round(d / 45) % 8;
  return dirs[idx];
}

function isRainy(code, precip) {
  if ((precip || 0) > 0) return true;
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
}

function buildSuggestion(temp, code, precip) {
  const t = Math.round(temp);
  const rainy = isRainy(code, precip);

  if (rainy && t < 16) {
    return {
      suggestion: `今日 ${t}°C 有雨偏凉，推荐防水外套 + 保暖内搭`,
      tips: ["防水风衣", "针织内搭", "防滑鞋"],
      hint: "防水外套优先",
    };
  }
  if (rainy) {
    return {
      suggestion: `今日 ${t}°C 有降水，推荐防水面料与便于行动的鞋履`,
      tips: ["薄防雨外套", "速干内搭", "防滑鞋"],
      hint: "记得带伞或外套",
    };
  }
  if (t >= 28) {
    return {
      suggestion: `今日 ${t}°C 偏热，推荐轻薄透气单品`,
      tips: ["短袖/背心", "阔腿裤或短裤", "透气鞋"],
      hint: "轻薄透气最佳",
    };
  }
  if (t >= 20) {
    return {
      suggestion: `今日 ${t}°C 气温适中，推荐薄款外套搭配`,
      tips: ["轻薄针织衫", "牛仔外套", "平底鞋"],
      hint: "薄外套出行最佳",
    };
  }
  if (t >= 12) {
    return {
      suggestion: `今日 ${t}°C 微凉，推荐长袖与轻薄外套`,
      tips: ["衬衫/针织", "薄外套", "休闲裤"],
      hint: "微凉，带件外套",
    };
  }
  return {
    suggestion: `今日 ${t}°C 偏冷，推荐保暖层次搭配`,
    tips: ["厚外套", "卫衣或毛衣", "长裤"],
    hint: "注意保暖",
  };
}

function formatDateLabel(isoDate) {
  // "2026-09-10"
  const parts = (isoDate || "").split("-");
  if (parts.length < 3) return "";
  return `${Number(parts[1])}月${Number(parts[2])}日`;
}

function formatMonthEyebrow(isoDate, conditionZh) {
  const parts = (isoDate || "").split("-");
  if (parts.length < 3) return conditionZh || "";
  const y = parts[0];
  const m = Number(parts[1]);
  return `${y} · ${MONTHS[m - 1]}月 · ${conditionZh}`;
}

function dayLabel(isoDate, index) {
  if (index === 0) return "今天";
  if (index === 1) return "明天";
  const d = new Date(`${isoDate}T12:00:00`);
  return `周${WEEKDAY[d.getDay()]}`;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      timeout: 12000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
          return;
        }
        reject(new Error(`请求失败 (${res.statusCode})`));
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || "网络请求失败"));
      },
    });
  });
}

function geocodeCity(query) {
  const key = query || "Hangzhou";
  if (CITY_FALLBACK[key]) {
    return Promise.resolve(CITY_FALLBACK[key]);
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    key
  )}&count=1&language=zh&format=json`;

  return requestJson(url).then((data) => {
    const hit = data.results && data.results[0];
    if (!hit) {
      if (CITY_FALLBACK.Hangzhou) return CITY_FALLBACK.Hangzhou;
      throw new Error("未找到城市");
    }
    return {
      name: hit.name || key,
      latitude: hit.latitude,
      longitude: hit.longitude,
      timezone: hit.timezone || "Asia/Shanghai",
      country: hit.country,
    };
  });
}

/** 逆地理：把坐标转成城市名（免费客户端接口） */
function reverseGeocode(latitude, longitude) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=zh`;
  return requestJson(url)
    .then((data) => {
      const name =
        data.city ||
        data.locality ||
        data.principalSubdivision ||
        data.localityInfo?.administrative?.[0]?.name ||
        "当前位置";
      return {
        name,
        latitude,
        longitude,
        timezone: "Asia/Shanghai",
        country: data.countryName,
      };
    })
    .catch(() => ({
      name: "当前位置",
      latitude,
      longitude,
      timezone: "auto",
    }));
}

function fetchForecastByPlace(place) {
  const params = [
    `latitude=${place.latitude}`,
    `longitude=${place.longitude}`,
    "current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,uv_index",
    "daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    `timezone=${encodeURIComponent(place.timezone || "auto")}`,
    "forecast_days=7",
  ].join("&");

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;

  return requestJson(url).then((data) => {
    const current = data.current;
    const daily = data.daily;
    if (!current) throw new Error("天气数据为空");

    const temp = Math.round(current.temperature_2m);
    const feels = Math.round(current.apparent_temperature);
    const code = current.weather_code;
    const precip = current.precipitation || 0;
    const conditionZh = codeZh(code);
    const advise = buildSuggestion(temp, code, precip);
    const windLabel = `${windDirLabel(current.wind_direction_10m)} ${Math.round(
      current.wind_speed_10m || 0
    )}km/h`;

    const todayIso = (daily && daily.time && daily.time[0]) || (current.time || "").slice(0, 10);

    const forecast = [];
    if (daily && daily.time) {
      daily.time.forEach((date, i) => {
        const dCode = daily.weather_code[i];
        forecast.push({
          day: dayLabel(date, i),
          date,
          cond: codeZh(dCode),
          icon: codeIcon(dCode),
          high: Math.round(daily.temperature_2m_max[i]),
          low: Math.round(daily.temperature_2m_min[i]),
          precip: daily.precipitation_sum ? daily.precipitation_sum[i] : 0,
        });
      });
    }

    return {
      city: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      fromLocation: !!place.fromLocation,
      localtime: current.time,
      date: formatDateLabel(todayIso),
      dateEyebrow: formatMonthEyebrow(todayIso, conditionZh),
      temp,
      feelslike: feels,
      condition: conditionZh,
      weatherCode: code,
      humidity: Math.round(current.relative_humidity_2m || 0),
      wind: windLabel,
      windSpeed: current.wind_speed_10m,
      uv: uvLabel(current.uv_index),
      uvIndex: current.uv_index,
      precip,
      rainy: isRainy(code, precip),
      cloudcover: Math.round(current.cloud_cover || 0),
      pressure: Math.round(current.pressure_msl || 0),
      icon: "",
      emoji: codeIcon(code),
      weatherTip: `${temp}°C · ${conditionZh}`,
      weatherHint: advise.hint,
      suggestion: advise.suggestion,
      tips: advise.tips,
      details: [
        { label: "体感", val: `${feels}°C` },
        { label: "降水", val: `${precip} mm` },
        { label: "云量", val: `${Math.round(current.cloud_cover || 0)}%` },
        { label: "气压", val: `${Math.round(current.pressure_msl || 0)} hPa` },
        { label: "湿度", val: `${Math.round(current.relative_humidity_2m || 0)}%` },
        { label: "紫外线", val: `${uvLabel(current.uv_index)} (${current.uv_index || 0})` },
      ],
      forecast,
      raw: data,
    };
  });
}

/**
 * 按城市名拉取天气
 * @param {string} query 城市名，如 Hangzhou / 杭州
 */
function fetchCurrentWeather(query) {
  return geocodeCity(query || "Hangzhou").then(fetchForecastByPlace);
}

/**
 * 按定位坐标拉取天气
 */
function fetchWeatherByLocation(latitude, longitude, displayName) {
  const base = {
    name: displayName || "当前位置",
    latitude,
    longitude,
    timezone: "auto",
    fromLocation: true,
  };

  if (displayName) {
    return fetchForecastByPlace(base);
  }

  return reverseGeocode(latitude, longitude).then((place) =>
    fetchForecastByPlace({
      ...place,
      fromLocation: true,
    })
  );
}

module.exports = {
  fetchCurrentWeather,
  fetchWeatherByLocation,
  reverseGeocode,
  codeZh,
  buildSuggestion,
};
