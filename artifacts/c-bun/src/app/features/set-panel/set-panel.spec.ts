import { ComponentFixture, TestBed } from "@angular/core/testing";
import { SetPanel } from "./set-panel";

describe("SetPanel", () => {
  let component: SetPanel;
  let fixture: ComponentFixture<SetPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
