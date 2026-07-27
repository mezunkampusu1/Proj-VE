export interface TaskAssignee {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface TaskCreator {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface SubtaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

export interface ColumnItem {
  id: string;
  name: string;
  order: number;
  isDoneColumn: boolean;
}

// Görevlendirme #199, revizyon #324/#327: kartta gösterilecek TÜM eklerin
// hafif özeti (bkz. flattenTask) — artık "kartta göster" işaretine BAKILMAKSIZIN
// göreve eklenmiş her ek buraya düşer. `showOnCard`, hangisinin kartın büyük
// KAPAK görseli (banner) olacağını belirten TEK seçimli (radio benzeri)
// bayraktır; diğer TÜM ekler (kapak olsun olmasın) kartta küçük ikon rozeti
// olarak gösterilir — kullanıcı talebi: "link eklendiği anda kartta göster
// demesekte icon olarak göster ... kartta göster demek kartın resmini
// değiştirmek demek".
export interface TaskCardImage {
  id: string;
  kind: string;
  mimeType: string | null;
  externalUrl: string | null;
  showOnCard: boolean;
}

export interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  columnId: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  kind: "DATED" | "FIXED";
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt?: string | null;
  position: number;
  assignees: TaskAssignee[];
  creator?: TaskCreator | null;
  subtasks: SubtaskItem[];
  tags: TagItem[];
  recurringTemplateId?: string | null;
  // Görevlendirme #199/#201, revizyon #324: kart önizleme görselleri
  // (birden fazla olabilir) ve kırmızı not rozeti.
  cardImages?: TaskCardImage[];
  commentCount?: number;
}

export interface TeamMemberOption {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}
