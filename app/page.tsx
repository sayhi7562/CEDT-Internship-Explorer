import JobBoard from "./components/JobBoard";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            CEDT Internship Explorer
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            เว็บไซต์ดูข้อมูลการฝึกงาน
          </h1>
          <p className="max-w-3xl text-sm text-zinc-600 sm:text-base">
            ดึงข้อมูลตำแหน่งฝึกงานจากเว็บคณะด้วย Cookie
            แบบคลิกเดียว พร้อมเปรียบเทียบค่าตอบแทนรายเดือน (แปลงรายวัน ×20
            วันอัตโนมัติ) ดูอัตราการแข่งขัน กรองหลายแท็ก
            อ่านรายละเอียดฉบับเต็มในหน้าเดียว และจำลองจัดอันดับ Shortlist
            เพื่อเช็คเกณฑ์ของ Pool ได้ทันที
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {/* <a
              className="text-sm text-blue-600 hover:text-blue-700 sm:text-base"
              href="/howtogetcookie.png"
              target="_blank"
              rel="noopener noreferrer"
            >
              ภาพตัวอย่างวิธีดู Cookie ↗
            </a> */}
            <a
              className="text-sm text-blue-600 hover:text-blue-700 sm:text-base"
              href="https://docs.google.com/spreadsheets/d/1nP0Gy1mMqMieqol0cXDuC7JSSOH8ERmkBIqX197jZHw/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
            >
              รีวิวฝึกงาน (Google Sheets) ↗
            </a>
            <a
              className="text-sm text-blue-600 hover:text-blue-700 sm:text-base"
              href="https://github.com/sayhi7562/CEDT-Internship-Explorer"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Repo ↗
            </a>
          </div>
        </header>
        <JobBoard />
      </main>
    </div>
  );
}
