// 選択肢マスタ（データモデルの「選択肢」タブに対応）
// 値を増やしたいときはここを編集する。DBにはテキストで保存される。

export const OPP_STAGES = ["リード", "商談予定済み", "商談済み", "受注", "失注", "保留"] as const;
export type OppStage = (typeof OPP_STAGES)[number];
export const OPP_OPEN_STAGES: OppStage[] = ["リード", "商談予定済み", "商談済み"];
export const OPP_STAGE_NOTE: Record<OppStage, string> = {
  リード: "商談前",
  商談予定済み: "商談の日程が決まっている",
  商談済み: "商談を1回以上行った",
  受注: "契約が決まった",
  失注: "",
  保留: "先方の事情などで止まっている",
};

export const ENG_STATUSES = ["Onboarding", "Customer Success", "契約終了"] as const;
export type EngStatus = (typeof ENG_STATUSES)[number];

export const PROBABILITIES = [10, 30, 50, 70, 90] as const;
export const BINARY_THRESHOLD = 50;
export const RENEWAL_DEFAULT_PROBABILITY = 30;
export const RENEWAL_LEAD_MONTHS = 6;

export const OPP_TYPES = ["新規", "更新", "アップセル"] as const;
export type OppType = (typeof OPP_TYPES)[number];

export const SCHOOL_TYPES = ["中学校", "高等学校", "中高一貫校", "特別支援学校", "その他"] as const;
export const ESTABLISHMENTS = ["公立", "私立", "国立"] as const;
export const COURSE_TYPES = ["普通制", "通信制"] as const;

export const CONTACT_ROLES = [
  "校長",
  "副校長・教頭",
  "ICT担当",
  "教務主任・学年主任",
  "教員",
  "進路担当",
  "理事長・法人本部",
  "探究・キャリア担当",
  "その他",
] as const;

export const CONTACT_STATUSES = ["在籍", "異動・退職"] as const;

export const ACTIVITY_TYPES = [
  "訪問（商談）",
  "オンライン商談",
  "電話",
  "メール/メッセージ送信",
  "メール/メッセージ受信",
  "イベント・展示会",
  "打ち合わせ（オンボーディング）",
  "打ち合わせ（カスタマーサクセス）",
  "ワークショップ/セミナー",
  "社内メモ",
  "その他",
] as const;

export const NEXT_ACTION_SOURCES = ["手入力", "更新案件の自動作成"] as const;

export const ROLES = ["編集", "閲覧"] as const;
export type Role = (typeof ROLES)[number];

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;
