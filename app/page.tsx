import JobBoard from "./components/JobBoard";

export default function Home() {
  return (
    <div className="bg-zinc-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            CEDT Internship Explorer
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            เว็บไซต์ดูข้อมูลการฝึกงาน
          </h1>
          <p className="max-w-2xl text-sm text-zinc-600 sm:text-base">
            ระบบมีเรียงค่าตอบแทนจากมากไปน้อย หากเป็นต่อวัน จะถูกแปลงเป็นต่อเดือน
            (×20 วัน) เพื่อให้เปรียบเทียบได้ง่าย
            และตัดตำแหน่งที่ไม่เปิดรับออกไปแล้ว
            และสามารถดึงข้อมูลจากเว็บโดยตรงได้ ผ่านการใช้ cookie
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              className="text-sm text-blue-600 hover:text-blue-700 sm:text-base"
              href="/howtogetcookie.png"
            >
              How to get cookie
            </a>
            <a
              className="text-sm text-blue-600 hover:text-blue-700 sm:text-base"
              href="https://github.com/sayhi7562/CEDT-Internship-Explorer"
            >
              Github Repo link
            </a>
          </div>
        </header>
        <JobBoard />
      </main>
    </div>
  );
}
