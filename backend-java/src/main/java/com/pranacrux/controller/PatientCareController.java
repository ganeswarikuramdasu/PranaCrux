package com.pranacrux.controller;
import com.pranacrux.common.ApiResponse;
import com.pranacrux.service.PatientCareService;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/patient/care")
public class PatientCareController {
    private final PatientCareService service;
    public PatientCareController(PatientCareService service){this.service=service;}
    @PostMapping("/run-check") public ApiResponse run(@RequestBody PatientCareService.RunCheckRequest request){return service.run(request);}
    @GetMapping("/{patientId}/checks") public ApiResponse history(@PathVariable String patientId){return service.history(patientId);}
    @GetMapping("/{patientId}/emergency-report") public ApiResponse report(@PathVariable String patientId){return service.emergencyReport(patientId);}
}
