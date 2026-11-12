import { TestBed } from "@angular/core/testing";
import { ExerciseTracker } from "./exercise-tracker";

describe("ExerciseTracker", () => {
  let service: ExerciseTracker;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExerciseTracker);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
