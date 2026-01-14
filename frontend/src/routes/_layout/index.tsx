import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/")({
  component: Home,
  head: () => ({
    meta: [
      {
        title: "MyKaraoke Video - Free Tools",
      },
    ],
  }),
})

function Home() {
  return (
    <div>
      <div>
        <h1 className="text-2xl">
          MyKaraoke Video Tools
        </h1>
        <p className="text-muted-foreground">
          Free tools for karaoke, audio processing, and music
        </p>
      </div>
    </div>
  )
}
