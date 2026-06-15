import { describe, it, expect } from "vitest";
import { prefilter } from "../prefilter";

describe("prefilter() — spam rules", () => {
  it("flags crypto solicitation", () => {
    expect(prefilter("Send 0.5 BTC to this wallet to get started").verdict).toBe("spam");
    expect(prefilter("Transfer ETH now and get guaranteed returns").verdict).toBe("spam");
  });

  it("flags guaranteed crypto returns", () => {
    expect(prefilter("Earn guaranteed daily profits with our crypto bot").verdict).toBe("spam");
  });

  it("flags a raw bitcoin address", () => {
    expect(prefilter("Send funds to 1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf").verdict).toBe("spam");
  });

  it("flags phishing language", () => {
    expect(prefilter("Click here to verify your account before it is suspended").verdict).toBe("spam");
  });

  it("flags suspicious TLD URLs", () => {
    expect(prefilter("Check out this great opportunity at http://earnnow.tk/join").verdict).toBe("spam");
  });

  it("flags MLM language", () => {
    expect(prefilter("Join my team and earn passive income — be your own boss!").verdict).toBe("spam");
  });

  it("flags threats", () => {
    expect(prefilter("I will hack you if you decline my application").verdict).toBe("spam");
  });
});

describe("prefilter() — profanity", () => {
  it("flags explicit slurs", () => {
    expect(prefilter("This project is run by a bunch of faggots").verdict).toBe("spam");
  });

  it("flags common profanity", () => {
    expect(prefilter("This is fucking terrible shit").verdict).toBe("spam");
  });
});

describe("prefilter() — clean content passes", () => {
  it("passes normal project description", () => {
    expect(prefilter("I am a TypeScript developer looking to contribute to open source projects.").verdict).toBe("pass");
  });

  it("passes a sincere low-effort pitch", () => {
    expect(prefilter("I want to help. I know React and have some free time.").verdict).toBe("pass");
  });

  it("passes technical content mentioning wallets in a legit context", () => {
    expect(prefilter("This project is a MetaMask wallet UI — I built a similar Ethereum dapp before.").verdict).toBe("pass");
  });

  it("passes github.com links", () => {
    expect(prefilter("See my work at https://github.com/rockinliam/corkbored").verdict).toBe("pass");
  });

  it("passes docs links", () => {
    expect(prefilter("Reference: https://docs.anthropic.com/en/api").verdict).toBe("pass");
  });
});
