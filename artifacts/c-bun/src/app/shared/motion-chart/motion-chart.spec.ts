import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MotionChart } from "./motion-chart";

describe("MotionChart", () => {
  let component: MotionChart;
  let fixture: ComponentFixture<MotionChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MotionChart],
    }).compileComponents();

    fixture = TestBed.createComponent(MotionChart);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
