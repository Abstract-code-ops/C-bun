import { TestBed } from "@angular/core/testing";
import { SetRecorder } from "./set-recorder";

describe("SetRecorder", () => {
  let service: SetRecorder;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SetRecorder);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
