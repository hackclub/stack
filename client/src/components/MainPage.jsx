import platformBackground from "@assets/platform/main/bkg.png";
import shopMtlUrl from "@assets/platform/main/bricks/shop_brick.mtl?url";
import shopObjUrl from "@assets/platform/main/bricks/shop_brick.obj?url";
import userAreaMtlUrl from "@assets/platform/main/bricks/userArea_brick.mtl?url";
import userAreaObjUrl from "@assets/platform/main/bricks/userArea_brick.obj?url";
import prjMtlUrl from "@assets/platform/main/bricks/prj_brick.mtl?url";
import prjObjUrl from "@assets/platform/main/bricks/prj_brick.obj?url";
import faqMtlUrl from "@assets/platform/main/bricks/faq_brick.mtl?url";
import faqObjUrl from "@assets/platform/main/bricks/faq_brick.obj?url";
import { useRef } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { MainNavBrickModel } from "./MainNavBrickModel.jsx";
import { PlatformStatusBar } from "./PlatformStatusBar.jsx";
import "./MainPage.css";

const defaultBrickRotation = { x: -1.10, y: -0.38, z: 0.02 };

function MainNavBrickLink({ block }) {
  const suppressNavigationRef = useRef(false);

  function maybeNavigate() {
    if (suppressNavigationRef.current) {
      suppressNavigationRef.current = false;
      return;
    }
    window.location.assign(block.path);
  }

  return (
    <div
      className={`platform-main__block ${block.className}`}
      role="link"
      tabIndex={0}
      aria-label={block.label}
      onClick={maybeNavigate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          maybeNavigate();
        }
      }}
    >
      <MainNavBrickModel
        mtlUrl={block.mtlUrl}
        objUrl={block.objUrl}
        rotation={block.rotation}
        onInteractDrag={() => {
          suppressNavigationRef.current = true;
        }}
      />
      <span className="platform-main__block-sr-only">{block.label}</span>
    </div>
  );
}

const navBlocks = [
  {
    label: "Shop",
    path: "/shop",
    className: "platform-main__block--shop",
    mtlUrl: shopMtlUrl,
    objUrl: shopObjUrl,
    rotation: defaultBrickRotation,
  },
  {
    label: "User Area",
    path: "/user",
    className: "platform-main__block--user",
    mtlUrl: userAreaMtlUrl,
    objUrl: userAreaObjUrl,
    rotation: defaultBrickRotation,
  },
  {
    label: "Projects",
    path: "/projects",
    className: "platform-main__block--projects",
    mtlUrl: prjMtlUrl,
    objUrl: prjObjUrl,
    rotation: defaultBrickRotation,
  },
  {
    label: "FAQ",
    path: "/faq",
    className: "platform-main__block--faq",
    mtlUrl: faqMtlUrl,
    objUrl: faqObjUrl,
    rotation: defaultBrickRotation,
  },
];

export function MainPage() {
  const { user } = useAuth();

  return (
    <main className="platform-main" aria-label="Platform main page">
      <img
        className="platform-main__background"
        src={platformBackground}
        alt=""
        aria-hidden="true"
      />
      <PlatformStatusBar user={user} />
      <nav className="platform-main__nav" aria-label="Main navigation">
        {navBlocks.map((block) => (
          <MainNavBrickLink key={block.path} block={block} />
        ))}
      </nav>
    </main>
  );
}
